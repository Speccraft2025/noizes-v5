export async function load({ locals }) {
  const sb = locals.supabase;

  const { data: releases, error } = await sb
    .from('releases')
    .select(`
      id, artist_name, title, genre, year, location,
      release_type, track_count, disc_count, total_duration_ms,
      edition_type, edition_name, edition_size, price, currency,
      acquired_count, cover_path, slug, artist_slug, visibility,
      tracks (id, position, disc_number, track_number, title, primary_artist, featured_artists, explicit, hidden)
    `)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('votes', { ascending: false });

  if (error) console.error('[tv] release listing failed:', error);

  const all = (releases ?? []).map((release) => ({
    ...release,
    cover_url: release.cover_path
      ? sb.storage.from('releases').getPublicUrl(release.cover_path).data?.publicUrl ?? null
      : null,
    tracks: (release.tracks ?? [])
      .filter((t) => !t.hidden)
      .sort((a, b) => a.position - b.position),
  }));

  return { releases: all };
}
