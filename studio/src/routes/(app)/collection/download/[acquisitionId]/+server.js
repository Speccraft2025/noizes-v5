import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { signedPackageUrl } from '$lib/server/storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns a download URL for the .nz of an edition the caller owns.
// Ownership-gated: only the current custodian gets a link, and the link is a
// short-lived signed URL into the private package bucket — the check and the
// bytes are the same gate now, where they used to be a check standing in front
// of a permanently public object. Bytes are served straight from Supabase
// Storage (never proxied through this endpoint) so we don't hit the
// SvelteKit/Netlify body-size ceiling; the signed URL's download parameter
// makes storage send Content-Disposition: attachment.
export async function GET({ params, locals }) {
  if (!locals.user) throw error(401, 'Log in');
  const { acquisitionId } = params;
  if (!UUID_RE.test(acquisitionId || '')) throw error(400, 'Bad acquisition id');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: acq } = await sb
    .from('acquisitions')
    .select('id, owner_id, edition_number, acquired_at, releases ( id, title, artist_name, release_type, nz_path, edition_name, edition_size )')
    .eq('id', acquisitionId)
    .maybeSingle();

  if (!acq) throw error(404, 'Not found');
  if (acq.owner_id !== locals.user.id) throw error(403, 'You do not hold this edition');

  const nzPath = acq.releases?.nz_path;
  if (!nzPath) throw error(409, 'This object has no downloadable package yet');

  const base = (acq.releases?.title || 'noizes').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const ed = acq.edition_number == null ? '' : `_ed${acq.edition_number}`;
  const filename = `${base}${ed}.nz`;

  // Signed and short-lived. The ownership check above used to guard a public
  // URL, which made it advisory — the bytes were reachable without it.
  let signedUrl;
  try {
    signedUrl = await signedPackageUrl(sb, nzPath, { download: filename });
  } catch (cause) {
    console.error(`[collection] could not sign download for ${acq.id}: ${cause.message}`);
    throw error(500, 'Could not resolve download URL');
  }

  let eventQuery = sb.from('provenance_events')
    .select('seq, kind, price, currency, note, occurred_at')
    .eq('release_id', acq.releases.id)
    .order('seq', { ascending: true });
  eventQuery = acq.edition_number == null
    ? eventQuery.is('edition_number', null)
    : eventQuery.eq('edition_number', acq.edition_number);

  const [{ data: events }, { data: note }] = await Promise.all([
    eventQuery,
    sb.from('collector_notes')
      .select('body, status')
      .eq('acquisition_id', acq.id)
      .maybeSingle(),
  ]);

  return json({
    url: signedUrl,
    filename,
    snapshot: {
      copy_id: acq.id,
      copy_number: acq.edition_number,
      acquired_at: acq.acquired_at,
      release: {
        release_id: acq.releases.id,
        title: acq.releases.title,
        primary_artist: acq.releases.artist_name,
        release_type: acq.releases.release_type || 'single',
      },
      edition: {
        edition_name: acq.releases.edition_name || 'First Edition',
        edition_size: acq.releases.edition_size,
      },
      events: events || [],
      collector_note: note?.body || '',
      generated_at: new Date().toISOString(),
    },
  });
}
