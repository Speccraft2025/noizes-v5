import { fail } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

// Request a password-reset link. Supabase emails a recovery link that lands on
// /auth/callback, which exchanges it for a short-lived session and forwards to
// /auth/reset to set a new password.
export const actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = form.get('email')?.toString().trim().toLowerCase();
    if (!email) return fail(400, { error: 'Enter your email.' });

    const supabase = createSupabaseServerClient(event);
    const redirectTo = `${event.url.origin}/auth/callback?next=${encodeURIComponent('/auth/reset')}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    // Never reveal whether the address exists. A rate-limit is the only surfaced
    // error; everything else resolves to the same "check your email" state.
    if (error && /rate limit|too many/i.test(error.message)) {
      return fail(429, { error: 'Too many attempts — wait a minute and try again.' });
    }
    return { sent: true, email };
  }
};
