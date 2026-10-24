import { getSupabaseServiceRoleClient } from '#lib/server/supabase.js';

const EVENTS = new Set([
  'exchange_viewed', 'rotation_window_viewed', 'release_impression',
  'appreciation_added', 'appreciation_removed', 'search_performed',
  'search_result_opened', 'release_explored', 'collector_market_opened',
  'collector_market_closed', 'collector_listing_viewed',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'This analytics batch could not be read.' }, { status: 400 });
  }
  if (!Array.isArray(body?.events) || body.events.length > 40) {
    return Response.json({ message: 'This analytics batch is invalid.' }, { status: 400 });
  }
  const events = body.events.flatMap((item) => {
    if (!EVENTS.has(item?.event)) return [];
    const releaseId = UUID.test(String(item?.release_id ?? '')) ? String(item.release_id) : null;
    return [{ event: item.event, ...(releaseId ? { release_id: releaseId } : {}) }];
  });
  if (!events.length) return Response.json({ recorded: 0 });

  const admin = getSupabaseServiceRoleClient();
  const { data, error } = await admin.rpc('record_exchange_analytics', { p_events: events });
  if (error) {
    console.error('[exchange] analytics batch failed:', error);
    return Response.json({ message: 'Analytics could not be recorded.' }, { status: 503 });
  }
  return Response.json({ recorded: Number(data ?? 0) });
}
