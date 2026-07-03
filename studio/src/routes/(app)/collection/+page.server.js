export async function load({ locals }) {
  const sb = locals.supabase;
  const userId = locals.user?.id;
  if (!userId) return { collection: [], events: [] };

  const { data: acquisitions } = await sb
    .from('acquisitions')
    .select(`
      id,
      edition_number,
      price_paid,
      currency,
      acquired_at,
      releases (
        id, artist_name, title, genre, year, location,
        edition_type, edition_size, cover_path
      )
    `)
    .eq('owner_id', userId)
    .order('acquired_at', { ascending: false });

  const collection = (acquisitions ?? []).map(a => ({
    id: a.id,
    artist: a.releases?.artist_name ?? '',
    title: a.releases?.title ?? '',
    genre: a.releases?.genre ?? '',
    year: a.releases?.year ?? '',
    location: a.releases?.location ?? '',
    edition_type: a.releases?.edition_type ?? '',
    edition_size: a.releases?.edition_size ?? null,
    edition_number: a.edition_number,
    release_id: a.releases?.id,
    acquired: a.acquired_at?.slice(0, 10),
    currency: a.currency,
    price: a.price_paid,
  }));

  const events = collection.map(c => ({
    date: c.acquired,
    work: `${c.artist} — ${c.title}`,
    event: 'purchased',
    price: `${c.currency} ${Number(c.price).toLocaleString()}`,
  }));

  return { collection, events };
}
