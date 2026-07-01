import { redirect } from '@sveltejs/kit';

// Public signup is disabled — accounts are created by admin invite only
export async function load() {
  throw redirect(303, '/auth/login?notice=invite_only');
}
