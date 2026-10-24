import { getSupabaseServiceRoleClient } from '#lib/server/supabase.js';
import { getExchangeVisitorCookieName, getExchangeWindow, makeExchangeVisitorHash } from '#lib/server/exchange.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ cookies, request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'This impression batch could not be read.' }, { status: 400 });
  }

  const { window, secret } = getExchangeWindow();
  const token = cookies.get(getExchangeVisitorCookieName());
  if (!token || !token.startsWith(`${window.id}.`) || body?.window_id !== window.id) {
    return Response.json({ message: 'This rotation window has expired.' }, { status: 409 });
  }
  const releaseIds = [...new Set((Array.isArray(body?.release_ids) ? body.release_ids : [])
    .map(String).filter((id) => UUID.test(id)))].slice(0, 20);
  if (!releaseIds.length) return Response.json({ recorded: 0 });

  const admin = getSupabaseServiceRoleClient();
  const { data, error } = await admin.rpc('record_exchange_impressions', {
    p_window_id: window.id,
    p_visitor_hash: makeExchangeVisitorHash(token, secret),
    p_release_ids: releaseIds,
  });
  if (error) {
    console.error('[exchange] impression batch failed:', error);
    return Response.json({ message: 'Release impressions could not be recorded.' }, { status: 503 });
  }
  return Response.json({ recorded: Number(data ?? 0) });
}
