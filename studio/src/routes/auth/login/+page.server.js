import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

export async function load({ locals, url }) {
  if (locals.session) throw redirect(303, '/exchange');
  return { notice: url.searchParams.get('notice') };
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
  },

  google: async (event) => {
    const supabase = createSupabaseServerClient(event);
    const next = new URL(event.request.url).searchParams.get('next') || '/exchange';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${event.url.origin}/auth/callback?next=${next}`,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) return fail(500, { error: error.message });
    throw redirect(303, data.url);
  }
};
