export async function load({ locals }) {
  const sb = locals.supabase;

  const { data: releases } = await sb
    .from('releases')
    .select('id, artist_name, title, genre, year, location, edition_type, edition_size, price, currency, acquired_count, votes, cover_path, status')
    .eq('status', 'published')
    .order('votes', { ascending: false });

  const all = releases ?? [];
  const featured = all.slice(0, 3);

  return { featured, feed: all };
}
