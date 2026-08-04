import { createSupabaseServerClient } from '$lib/server/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

export function handleError({ error, event }) {
  console.error('[handleError]', event.url.pathname, error?.message ?? error);
  return { message: 'An error occurred.' };
}

const CREATOR_ROUTES = ['/studio'];
const AUTH_ROUTES = ['/collection'];
const ADMIN_ROUTES = ['/admin'];

// Reads public.invites, which is service-role-only. Carries no user session,
// so it is never used for anything but the membership lookup below.
const inviteReader = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function handle({ event, resolve }) {
  const supabase = createSupabaseServerClient(event);
  event.locals.supabase = supabase;

  const { data: { user } } = await supabase.auth.getUser();
  event.locals.user = user ?? null;
  event.locals.session = user ? { user } : null;

  // Load profile if authenticated
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    event.locals.profile = profile;
  } else {
    event.locals.profile = null;
  }

  const path = event.url.pathname;

  // Invite-only enforcement. public.invites gates account creation at the
  // database level, but a session minted before that gate existed would still
  // carry a valid cookie, so every authenticated request re-checks membership
  // and tears down the session if the invite is gone (or was never there).
  // Admins bypass, so a mistake here can never lock out the admin account.
  if (user && user.email && !event.locals.profile?.is_admin && !path.startsWith('/auth/')) {
    const { data: invite } = await inviteReader
      .from('invites')
      .select('email')
      .eq('email', user.email?.toLowerCase())
      .maybeSingle();

    if (!invite) {
      await supabase.auth.signOut();
      event.locals.user = null;
      event.locals.session = null;
      event.locals.profile = null;
      throw redirect(303, '/auth/login?notice=not_invited');
    }
  }
  // Preserve query params through login — a deep link that carries state in
  // its query string must survive the auth round trip, not arrive stripped.
  const nextTarget = encodeURIComponent(path + event.url.search);

  // Guard creator-only routes
  if (CREATOR_ROUTES.some(r => path.startsWith(r))) {
    if (!user) throw redirect(303, `/auth/login?next=${nextTarget}`);
    if (event.locals.profile?.role !== 'creator') throw redirect(303, '/exchange');
  }

  // Guard auth-required routes
  if (AUTH_ROUTES.some(r => path.startsWith(r))) {
    if (!user) throw redirect(303, `/auth/login?next=${nextTarget}`);
  }

  // Guard admin routes. This must live here (not just in admin/+layout.server.js's
  // load()) because SvelteKit does not run parent load() functions before executing
  // a POST form action — without this, any authenticated user could POST directly to
  // an admin action (e.g. /admin/users?/deleteUser) and bypass the page-level redirect.
  if (ADMIN_ROUTES.some(r => path.startsWith(r))) {
    if (!user) throw redirect(303, `/auth/login?next=${nextTarget}`);
    if (!event.locals.profile?.is_admin) throw redirect(303, '/exchange');
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
}
