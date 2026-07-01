import { redirect, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  if (locals.session) {
    const role = locals.profile?.role;
    throw redirect(303, role === 'creator' ? '/studio' : '/exchange');
  }
  return {};
}

export const actions = {
  waitlist: async ({ request }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().trim().toLowerCase();
    const role = form.get('role')?.toString() || 'collector';

    if (!email || !email.includes('@')) {
      return fail(400, { error: 'Please enter a valid email address.' });
    }

    const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await sb.from('waitlist').upsert(
      { email, role, source: 'landing' },
      { onConflict: 'email', ignoreDuplicates: true }
    );

    if (error) return fail(500, { error: 'Something went wrong. Please try again.' });
    return { success: true };
  }
};
