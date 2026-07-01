import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.session) throw redirect(303, '/auth/login?next=/admin');
  if (!locals.profile?.is_admin) throw redirect(303, '/exchange');
  return { profile: locals.profile, user: locals.user };
}
