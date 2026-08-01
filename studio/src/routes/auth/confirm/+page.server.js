import { redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

export function load({ url }) {
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) throw redirect(303, '/auth/login?notice=auth_failed');
  return { tokenHash };
}

export const actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const tokenHash = form.get('token_hash')?.toString();
    if (!tokenHash) throw redirect(303, '/auth/login?notice=auth_failed');

    const supabase = createSupabaseServerClient(event);
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'invite',
    });
    if (error || !data.user) throw redirect(303, '/auth/login?notice=auth_failed');

    // @supabase/ssr stores the verified session in cookies. New collaborators
    // create a password before entering the creator-only Studio.
    throw redirect(303, '/auth/reset?invite=1&next=%2Fstudio');
  },
};
