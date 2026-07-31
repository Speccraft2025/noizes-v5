import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const adminClient = () => createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function load() {
  const { data: notes, error } = await adminClient()
    .from('collector_notes')
    .select('id, body, status, created_at, profiles!collector_notes_author_id_fkey(display_name, email), acquisitions(releases(artist_name, title))')
    .order('created_at', { ascending: false })
    .limit(100);
  return { notes: notes ?? [], loadError: error?.message ?? null };
}

async function setStatus(request, status) {
  const form = await request.formData();
  const id = form.get('id')?.toString();
  if (!UUID_RE.test(id || '')) return fail(400, { error: 'Valid note id required.' });
  const { error } = await adminClient().from('collector_notes').update({ status }).eq('id', id);
  if (error) return fail(500, { error: error.message });
  return { updated: id };
}

export const actions = {
  hide: ({ request }) => setStatus(request, 'hidden'),
  restore: ({ request }) => setStatus(request, 'visible'),
};
