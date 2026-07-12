import { createSupabaseServerClient } from '$lib/server/supabase.js';
import { redirect } from '@sveltejs/kit';

export function handleError({ error, event }) {
  console.error('[handleError]', event.url.pathname, error?.message ?? error);
  return { message: 'An error occurred.' };
}

const CREATOR_ROUTES = ['/studio'];
const AUTH_ROUTES = ['/collection'];
const ADMIN_ROUTES = ['/admin'];

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
  // Preserve query params (e.g. the beatsunlimited deal handoff) through login
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
