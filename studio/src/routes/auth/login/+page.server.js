import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

export async function load({ locals, url }) {
  if (locals.session) throw redirect(303, url.searchParams.get('next') || '/exchange');
  // ?error= is what the callback redirects with when a sign-in fails; surface it
  // as a notice so the page always explains itself rather than rendering a bare
  // form that invites the user to just try again.
  return {
    notice: url.searchParams.get('notice') ?? (url.searchParams.get('error') ? 'auth_failed' : null)
  };
}

export const actions = {
  email: async (event) => {
    const { request } = event;
    const form = await request.formData();
    const email = form.get('email')?.toString().trim();
    const password = form.get('password')?.toString();

    if (!email || !password) return fail(400, { error: 'Email and password are required.' });

    const supabase = createSupabaseServerClient(event);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return fail(401, { error: 'Invalid email or password.' });

    const next = new URL(request.url).searchParams.get('next') || '/exchange';
    throw redirect(303, next);
  }
};
