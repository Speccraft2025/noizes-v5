import { redirect } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase.js';

export async function GET(event) {
  const supabase = createSupabaseServerClient(event);
  await supabase.auth.signOut();
  throw redirect(303, '/');
}
