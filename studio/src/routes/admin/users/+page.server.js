import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  const { data: users } = await locals.supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { users: users ?? [] };
}

export const actions = {
  // All actions write via the service role: profiles RLS only lets a user
  // update their own row, and the protect_privileged_profile_columns trigger
  // pins is_admin/role for non-service-role writers — a session-client update
  // here silently no-ops. (Route access is already admin-gated in hooks.)
  toggleAdmin: async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    const current = form.get('is_admin') === 'true';
    if (!id) return fail(400, { error: 'ID required.' });
    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await adminClient
      .from('profiles')
      .update({ is_admin: !current })
      .eq('id', id);
    if (error) return fail(500, { error: error.message });
    return { toggled: true };
  },

  changeRole: async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    const role = form.get('role')?.toString();
    if (!id || !['creator', 'collector'].includes(role)) return fail(400, { error: 'ID and valid role required.' });
    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', id);
    if (error) return fail(500, { error: error.message });
    return { changed: true };
  },

  deleteUser: async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return fail(400, { error: 'ID required.' });

    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Grab the email before the profile row cascades away with the auth user.
    const { data: target } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', id)
      .maybeSingle();

    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) return fail(500, { error: error.message });

    // Revoke the invite too — otherwise the address stays on the allowlist and
    // could be used to create a fresh account. Deleting the user without
    // revoking access is a silent security gap, so surface any failure.
    if (!target?.email) {
      return fail(500, { error: 'User deleted, but their invite could not be looked up — revoke it manually in Supabase (invites table).' });
    }
    const { error: revokeErr } = await adminClient.from('invites').delete().eq('email', target.email.toLowerCase());
    if (revokeErr) {
      return fail(500, { error: `User deleted, but invite revocation failed: ${revokeErr.message} — revoke ${target.email} manually.` });
    }

    return { deleted: true };
  }
};
