import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

// The recovery link lands here via /auth/callback, which has already exchanged
// the code for a session. No valid session ⇒ the link was missing/expired, so
// send the user back to request a fresh one.
export async function load({ locals }) {
  if (!locals.user) throw redirect(303, '/auth/recover');
  return {};
}

const MIN_LEN = 10;

export const actions = {
  default: async (event) => {
    if (!event.locals.user) throw redirect(303, '/auth/recover');

    const form = await event.request.formData();
    const password = form.get('password')?.toString() ?? '';
    const confirm = form.get('confirm')?.toString() ?? '';

    if (password.length < MIN_LEN) {
      return fail(400, { error: `Use at least ${MIN_LEN} characters.` });
    }
    if (password !== confirm) {
      return fail(400, { error: 'Passwords do not match.' });
    }

    const supabase = createSupabaseServerClient(event);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // Supabase enforces its own strength / leaked-password checks here.
      return fail(400, { error: error.message || 'Could not update password.' });
    }

    throw redirect(303, '/exchange');
  }
};
