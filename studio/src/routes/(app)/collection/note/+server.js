import { json, error } from '@sveltejs/kit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Write / update the current custodian's stewardship note (one per stewardship).
// Runs under the user's RLS session: the insert/update policies already enforce
// "author owns the acquisition". On the next transfer the note is folded into
// the signed provenance chain and cleared for the next custodian.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Log in to leave a note');
  const sb = locals.supabase;

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const acquisitionId = body?.acquisition_id;
  const text = String(body?.body || '').trim();
  if (!UUID_RE.test(acquisitionId || '')) throw error(400, 'acquisition_id must be a uuid');
  if (text.length < 1 || text.length > 280) throw error(400, 'Note must be 1–280 characters');

  // Upsert on the unique(acquisition_id) constraint. RLS blocks writing a note
  // for an edition you do not currently own.
  const { error: upErr } = await sb
    .from('collector_notes')
    .upsert(
      { acquisition_id: acquisitionId, author_id: locals.user.id, body: text, status: 'visible' },
      { onConflict: 'acquisition_id' }
    );
  if (upErr) {
    // RLS denial surfaces as an insert/permission error.
    throw error(403, 'You can only leave a note on an edition you currently hold');
  }

  return json({ ok: true });
}
