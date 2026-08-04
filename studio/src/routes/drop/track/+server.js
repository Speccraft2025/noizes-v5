import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { bumpDropAnalytics } from '$lib/server/drop-page.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(['share', 'qr', 'experience_open', 'download', 'acquire_start', 'acquire_complete']);

// Aggregate counters only: one row per release, per day, per event kind.
// Nothing identifies a visitor, so there is nothing here to correlate later,
// and the underlying RPC ignores events for releases that are not public.
//
// Always answers 200. A counter that can fail a fetch on the page it measures
// would turn a metrics outage into a broken Drop Page.
export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: true });
  }

  const releaseId = body?.release_id;
  if (!UUID_RE.test(releaseId || '')) return json({ ok: true });

  const events = Array.isArray(body?.events) ? body.events : [];
  // Bounded so a hostile caller cannot turn one request into a thousand writes.
  const wanted = [...new Set(events.filter((event) => ALLOWED.has(event)))].slice(0, 8);
  if (!wanted.length) return json({ ok: true });

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await Promise.all(wanted.map((event) => bumpDropAnalytics(sb, releaseId, event)));

  return json({ ok: true });
}
