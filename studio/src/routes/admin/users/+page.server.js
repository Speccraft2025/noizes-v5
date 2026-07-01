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
  toggleAdmin: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    const current = form.get('is_admin') === 'true';
    if (!id) return fail(400, { error: 'ID required.' });
    const { error } = await locals.supabase
      .from('profiles')
      .update({ is_admin: !current })
      .eq('id', id);
    if (error) return fail(500, { error: error.message });
    return { toggled: true };
  },

  changeRole: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    const role = form.get('role')?.toString();
    if (!id || !role) return fail(400, { error: 'ID and role required.' });
    const { error } = await locals.supabase
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
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) return fail(500, { error: error.message });
    return { deleted: true };
  }
};
