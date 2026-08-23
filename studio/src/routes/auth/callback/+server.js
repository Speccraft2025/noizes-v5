import { redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

// GoTrue reports a trigger rejection as a generic "Database error saving new
// user" — our noizes_invite_required message is not passed through. Since the
// invite trigger is the only thing that rejects a user insert, that string
// means "not on the invite list" in practice.
const INVITE_BLOCKED = /invite|saving new user/i;

export async function GET(event) {
  const { url } = event;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/exchange';

  // The provider can bounce us here with an error instead of a code. Translate
  // it rather than dumping the user back on a silent login form.
  const providerError = url.searchParams.get('error');
  if (providerError) {
    const desc = url.searchParams.get('error_description') ?? '';
    const notice = INVITE_BLOCKED.test(desc) ? 'not_invited' : 'auth_failed';
    throw redirect(303, `/auth/login?notice=${notice}`);
  }

  if (code) {
    const supabase = createSupabaseServerClient(event);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Access is invite-only. public.invites is the source of truth; the
      // auth.users insert trigger should already have blocked an uninvited
      // signup, but this session-level check means a session that somehow
      // exists without an invite (e.g. one minted before the gate landed)
      // still cannot get in. invites is service-role-read, so use an admin
      // client rather than the caller's.
      const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: invite } = await admin
        .from('invites')
        .select('role')
        .eq('email', data.user.email?.toLowerCase())
        .maybeSingle();

      if (!invite) {
        await supabase.auth.signOut();
        throw redirect(303, '/auth/login?notice=not_invited');
      }

      // Upsert profile — preserve role if already set
      const { data: existing } = await supabase
        .from('profiles')
        .select('role, password_set')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
          avatar_url: data.user.user_metadata?.avatar_url || null,
          role: invite.role
        });
      }

      // If the user hasn't set a password yet, redirect to the password
      // setup page before continuing. Recovery links (next=/auth/reset)
      // are already going there, so skip the redirect for those.
      if (!existing?.password_set && !next.startsWith('/auth/reset')) {
        throw redirect(303, `/auth/reset?setup=1&next=${encodeURIComponent(next)}`);
      }

      throw redirect(303, next);
    }
  }

  // No code, or the exchange failed — most often an invite link that already
  // got used or timed out.
  throw redirect(303, '/auth/login?notice=auth_failed');
}
