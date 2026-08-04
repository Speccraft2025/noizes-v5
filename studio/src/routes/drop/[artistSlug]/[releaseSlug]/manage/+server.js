import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import { resolveDropAddress } from '$lib/server/drop-page.js';
import { unpublishRelease, PublishError } from '$lib/server/publish-release.js';

const MAX_LABEL = 60;
const MAX_LINKS = 12;

/** https only, no credentials in the URL, no absurd length. */
function validateExternalUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.href.length > 500) return null;
  return url.href;
}

// Creator-only mutations of a published Drop Page. Every field a creator may
// change is listed explicitly: spreading the request body into an update would
// let a creator write status, slug, acquired_count or artist_id, which are not
// theirs to set.
export async function POST({ params, request, locals }) {
  if (!locals.user) throw error(401, 'Sign in to manage this release.');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { release } = await resolveDropAddress(sb, {
    artistSlug: params.artistSlug,
    slug: params.releaseSlug,
  });
  if (!release) throw error(404, 'No release lives at this address.');
  if (release.artist_id !== locals.user.id) throw error(403, 'This is not your release.');

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON.');
  }

  try {
    if (body.action === 'withdraw') {
      const updated = await unpublishRelease(sb, { releaseId: release.id, artistId: locals.user.id });
      return json({ ok: true, status: updated.status });
    }

    if (body.action === 'republish') {
      const { data, error: err } = await sb
        .from('releases')
        .update({ status: 'published', withdrawn_at: null })
        .eq('id', release.id)
        .select('status')
        .single();
      if (err) throw error(500, `Could not publish again: ${err.message}`);
      return json({ ok: true, status: data.status });
    }

    if (body.action === 'links') {
      const incoming = Array.isArray(body.links) ? body.links.slice(0, MAX_LINKS) : [];
      const rows = [];
      for (const [index, link] of incoming.entries()) {
        const url = validateExternalUrl(link?.url);
        const label = String(link?.label ?? '').trim().slice(0, MAX_LABEL);
        if (!url || !label) {
          throw error(400, `Link ${index + 1} needs a label and an https:// address.`);
        }
        rows.push({
          release_id: release.id,
          label,
          url,
          link_type: String(link?.link_type ?? 'other').slice(0, 30),
          position: index,
          enabled: link?.enabled !== false,
        });
      }
      // Replace wholesale: the client sends the list it wants, in order.
      const { error: clearErr } = await sb.from('release_links').delete().eq('release_id', release.id);
      if (clearErr) throw error(500, `Could not update links: ${clearErr.message}`);
      if (rows.length) {
        const { error: insertErr } = await sb.from('release_links').insert(rows);
        if (insertErr) throw error(500, `Could not update links: ${insertErr.message}`);
      }
      return json({ ok: true, links: rows.length });
    }

    if (body.action === 'update') {
      const patch = {};
      if (body.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) throw error(400, 'Price must be zero or more.');
        patch.price = price;
      }
      if (body.drop_description !== undefined) {
        patch.drop_description = String(body.drop_description ?? '').slice(0, 400) || null;
      }
      if (body.allow_public_download !== undefined) {
        patch.allow_public_download = Boolean(body.allow_public_download);
      }
      if (body.offers_enabled !== undefined) patch.offers_enabled = Boolean(body.offers_enabled);
      if (body.resale_enabled !== undefined) patch.resale_enabled = Boolean(body.resale_enabled);
      if (body.visibility !== undefined) {
        if (!['public', 'unlisted'].includes(body.visibility)) throw error(400, 'Unknown visibility.');
        patch.visibility = body.visibility;
      }
      if (!Object.keys(patch).length) return json({ ok: true, changed: 0 });

      const { error: err } = await sb.from('releases').update(patch).eq('id', release.id);
      if (err) throw error(500, `Could not save those changes: ${err.message}`);
      return json({ ok: true, changed: Object.keys(patch).length });
    }
  } catch (cause) {
    if (cause instanceof PublishError) throw error(cause.status, cause.message);
    throw cause;
  }

  throw error(400, 'Unknown action.');
}
