import { fail, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

// The recovery link lands here via /auth/callback, which has already exchanged
// the code for a session. No valid session ⇒ the link was missing/expired, so
// send the user back to request a fresh one.
function safeNextPath(value) {
  const path = String(value || '');
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/exchange';
}

export async function load({ locals, url }) {
  if (!locals.user) throw redirect(303, '/auth/recover');
  return {
    invite: url.searchParams.get('invite') === '1',
    setup: url.searchParams.get('setup') === '1',
    next: safeNextPath(url.searchParams.get('next')),
  };
}

const MIN_LEN = 10;

export const actions = {
  default: async (event) => {
    if (!event.locals.user) throw redirect(303, '/auth/recover');

    const form = await event.request.formData();
    const password = form.get('password')?.toString() ?? '';
    const confirm = form.get('confirm')?.toString() ?? '';
    const next = safeNextPath(form.get('next'));

    if (password.length < MIN_LEN) {
      return fail(400, { error: `Use at least ${MIN_LEN} characters.` });
    }
    if (password !== confirm) {
      return fail(400, { error: 'Passwords do not match.' });
    }

    const supabase = createSupabaseServerClient(event);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return fail(400, { error: error.message || 'Could not update password.' });
    }

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.from('profiles').update({ password_set: true }).eq('id', event.locals.user.id);

    throw redirect(303, next);
  }
};
