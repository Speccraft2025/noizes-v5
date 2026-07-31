import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load() {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [
    { count: waitlistCount },
    { count: userCount },
    { data: recentWaitlist },
    { data: recentUsers },
    { count: kycPendingCount }
  ] = await Promise.all([
    sb.from('waitlist').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('waitlist').select('email, role, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('profiles').select('display_name, email, role, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const cutoff = new Date(Date.now() - 3600000).toISOString();
  const [{ count: stuckCount }, { count: staleCount }] = await Promise.all([
    sb.from('payment_intents').select('*', { count: 'exact', head: true }).eq('status', 'needs_reconciliation'),
    sb.from('payment_intents').select('*', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', cutoff),
  ]);
  const reconciliationCount = (stuckCount ?? 0) + (staleCount ?? 0);

  return { waitlistCount, userCount, recentWaitlist, recentUsers, kycPendingCount, reconciliationCount };
}
