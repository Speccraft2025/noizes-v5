import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load() {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - 3600000).toISOString();
  const [{ data: stuck }, { data: stale }] = await Promise.all([
    sb.from('payment_intents')
      .select('id, reference, kind, amount_subunits, currency, status, created_at, paystack_data')
      .eq('status', 'needs_reconciliation').order('created_at', { ascending: true }),
    sb.from('payment_intents')
      .select('id, reference, kind, amount_subunits, currency, status, created_at, paystack_data')
      .eq('status', 'pending').lt('created_at', cutoff).order('created_at', { ascending: true }),
  ]);
  return { intents: [...(stuck ?? []), ...(stale ?? [])] };
}
