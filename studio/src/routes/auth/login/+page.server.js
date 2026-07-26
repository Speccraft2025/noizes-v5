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

function nextParam(request) {
  return new URL(request.url).searchParams.get('next') || '/exchange';
}

export const actions = {
  // Password sign-in (kept for people who set one). Invite membership is
  // re-checked on every request in hooks.server.js, so a valid password for a
  // de-invited account still can't get in.
  email: async (event) => {
    const form = await event.request.formData();
    const email = form.get('email')?.toString().trim().toLowerCase();
    const password = form.get('password')?.toString();

    if (!email || !password) return fail(400, { error: 'Email and password are required.', mode: 'password' });

    const supabase = createSupabaseServerClient(event);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Uniform message — never reveal whether an email exists.
    if (error) return fail(401, { error: 'Invalid email or password.', mode: 'password' });

    throw redirect(303, nextParam(event.request));
  },

  // Passwordless magic link — the default, secure + easy-to-recover path. No
  // password to phish, reuse, or forget; getting back in is always "send me a
  // link". shouldCreateUser:false keeps it invite-only (never mints an account).
  magic: async (event) => {
    const form = await event.request.formData();
    const email = form.get('email')?.toString().trim().toLowerCase();
    if (!email) return fail(400, { error: 'Enter your email.', mode: 'magic' });

    const supabase = createSupabaseServerClient(event);
    const next = nextParam(event.request);
    const emailRedirectTo = `${event.url.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo }
    });

    // Do not leak whether the address exists or is invited: always show the
    // same "check your email" confirmation. An uninvited/unknown address simply
    // never receives a link. Only a rate-limit is surfaced as a real error.
    if (error && /rate limit|too many/i.test(error.message)) {
      return fail(429, { error: 'Too many attempts — wait a minute and try again.', mode: 'magic' });
    }

    return { sent: true, email };
  }
};
