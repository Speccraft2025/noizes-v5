import { redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

export async function GET(event) {
  const { url, cookies } = event;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/exchange';

  if (code) {
    const supabase = createSupabaseServerClient(event);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Upsert profile — preserve role if already set
      const { data: existing } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!existing) {
        const role = url.searchParams.get('role') || 'collector';
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
          avatar_url: data.user.user_metadata?.avatar_url || null,
          role
        });
      }

      throw redirect(303, next);
    }
  }

  throw redirect(303, '/auth/login?error=auth_failed');
}
