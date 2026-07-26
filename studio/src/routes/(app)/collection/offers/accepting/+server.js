import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Toggle whether an edition the caller owns is open to offers. Owners can't
// update acquisitions under RLS (writes are service-role), so this endpoint
// guards ownership then flips the flag with the service client.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Log in');

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const acquisitionId = body?.acquisition_id;
  const accepting = !!body?.accepting;
  if (!UUID_RE.test(acquisitionId || '')) throw error(400, 'acquisition_id must be a uuid');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: updated, error: upErr } = await sb
    .from('acquisitions')
    .update({ accepting_offers: accepting })
    .eq('id', acquisitionId)
    .eq('owner_id', locals.user.id)
    .select('id')
    .maybeSingle();
  if (upErr) throw error(500, 'Could not update');
  if (!updated) throw error(403, 'You do not own this edition');

  return json({ ok: true, accepting });
}
