import { createSupabaseServerClient } from '$lib/server/supabase.js';
import { redirect } from '@sveltejs/kit';

export function handleError({ error, event }) {
  console.error('[handleError]', event.url.pathname, error?.message ?? error);
  return { message: 'An error occurred.' };
}

const CREATOR_ROUTES = ['/studio'];
const AUTH_ROUTES = ['/collection'];

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

  // Guard creator-only routes
  if (CREATOR_ROUTES.some(r => path.startsWith(r))) {
    if (!user) throw redirect(303, `/auth/login?next=${path}`);
    if (event.locals.profile?.role !== 'creator') throw redirect(303, '/exchange');
  }

  // Guard auth-required routes
  if (AUTH_ROUTES.some(r => path.startsWith(r))) {
    if (!user) throw redirect(303, `/auth/login?next=${path}`);
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
}
