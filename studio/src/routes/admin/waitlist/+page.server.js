import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  const sb = locals.supabase;
  const { data: entries, error } = await sb
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });

  // Get already-invited emails from profiles
  const { data: profiles } = await sb.from('profiles').select('email');
  const invitedEmails = new Set(profiles?.map(p => p.email) ?? []);

  return {
    entries: (entries ?? []).map(e => ({ ...e, invited: invitedEmails.has(e.email) }))
  };
}

export const actions = {
  invite: async ({ request, locals }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().trim();
    const role  = form.get('role')?.toString() || 'collector';

    if (!email) return fail(400, { error: 'Email required.' });

    // Use service role to send invite (bypasses auth)
    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role, display_name: email.split('@')[0] },
      redirectTo: `https://noizes.xyz/auth/callback`
    });

    if (error) return fail(500, { inviteError: error.message, failedEmail: email });
    return { invited: email };
  },

  delete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return fail(400, { error: 'ID required.' });
    await locals.supabase.from('waitlist').delete().eq('id', id);
    return { deleted: true };
  }
};
