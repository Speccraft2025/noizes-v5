import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { transferCustody, TransferError } from '$lib/server/transfer.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Non-monetary custody hand-off. The current custodian gives an edition to
// another Noizes user by email. Records a signed 'transferred' provenance
// event and folds the outgoing steward's note. Money-based resale goes through
// the offer book, not here.
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Log in to transfer');

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Request body must be JSON');
  }
  const acquisitionId = body?.acquisition_id;
  const toEmail = String(body?.to_email || '').trim().toLowerCase();
  if (!UUID_RE.test(acquisitionId || '')) throw error(400, 'acquisition_id must be a uuid');
  if (!toEmail || !toEmail.includes('@')) throw error(400, 'to_email must be a valid email');

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: recipient } = await sb
    .from('profiles')
    .select('id')
    .eq('email', toEmail)
    .maybeSingle();
  if (!recipient) throw error(404, 'No Noizes account with that email');
  if (recipient.id === locals.user.id) throw error(400, 'You already hold this edition');

  try {
    const { acquisition, event } = await transferCustody(sb, {
      acquisitionId,
      expectedFromOwnerId: locals.user.id,
      toOwnerId: recipient.id,
    });
    return json({ ok: true, acquisition_id: acquisition.id, seq: event.seq });
  } catch (e) {
    if (e instanceof TransferError) {
      const status = e.code === 'not_found' ? 404 : e.code === 'not_owner' ? 409 : 400;
      throw error(status, e.message);
    }
    console.error(`[transfer] unexpected: ${e.message}`);
    throw error(500, 'Transfer failed');
  }
}
