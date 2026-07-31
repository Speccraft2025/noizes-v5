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
      accepting_offers,
      releases (
        id, artist_name, title, genre, year, location,
        release_type, track_count, disc_count, total_duration_ms,
        compilation_artists, explicit, package_size,
        edition_type, edition_name, edition_size, cover_path,
        tracks (id, position, disc_number, track_number, title, primary_artist, hidden)
      )
    `)
    .eq('owner_id', userId)
    .order('acquired_at', { ascending: false });

  const acqs = acquisitions ?? [];

  // Current stewardship notes for these editions (one per acquisition).
  const acqIds = acqs.map((a) => a.id);
  let notesByAcq = {};
  if (acqIds.length) {
    const { data: notes } = await sb
      .from('collector_notes')
      .select('acquisition_id, body, status')
      .in('acquisition_id', acqIds);
    for (const n of notes ?? []) notesByAcq[n.acquisition_id] = n;
  }

  // The Living Record for each edition the user holds. Provenance is public,
  // so this loads the full history, not just the user's tenure.
  const releaseIds = [...new Set(acqs.map((a) => a.releases?.id).filter(Boolean))];
  let eventsByEdition = {};
  if (releaseIds.length) {
    const { data: pevents } = await sb
      .from('provenance_events')
      .select('release_id, edition_number, seq, kind, price, currency, note, occurred_at')
      .in('release_id', releaseIds)
      .order('seq', { ascending: true });
    for (const e of pevents ?? []) {
      const key = `${e.release_id}:${e.edition_number ?? 'open'}`;
      (eventsByEdition[key] ||= []).push(e);
    }
  }

  const collection = acqs.map((a) => {
    const key = `${a.releases?.id}:${a.edition_number ?? 'open'}`;
    return {
      id: a.id,
      artist: a.releases?.artist_name ?? '',
      title: a.releases?.title ?? '',
      genre: a.releases?.genre ?? '',
      year: a.releases?.year ?? '',
      location: a.releases?.location ?? '',
      release_type: a.releases?.release_type ?? 'single',
      track_count: a.releases?.track_count ?? 0,
      disc_count: a.releases?.disc_count ?? 1,
      total_duration_ms: a.releases?.total_duration_ms ?? 0,
      compilation_artists: a.releases?.compilation_artists ?? [],
      explicit: Boolean(a.releases?.explicit),
      package_size: a.releases?.package_size ?? 0,
      tracklist: (a.releases?.tracks ?? []).sort((left, right) => left.position - right.position),
      edition_type: a.releases?.edition_type ?? '',
      edition_name: a.releases?.edition_name ?? '',
      edition_size: a.releases?.edition_size ?? null,
      edition_number: a.edition_number,
      release_id: a.releases?.id,
      edition_label: a.edition_number == null ? 'open' : String(a.edition_number),
      acquired: a.acquired_at?.slice(0, 10),
      currency: a.currency,
      price: a.price_paid,
      accepting_offers: a.accepting_offers,
      note: notesByAcq[a.id]?.body ?? '',
      living_record: (eventsByEdition[key] ?? []).map((e) => ({
        seq: e.seq,
        kind: e.kind,
        note: e.note,
        price: e.price != null ? `${e.currency} ${Number(e.price).toLocaleString()}` : null,
        date: e.occurred_at?.slice(0, 10),
      })),
    };
  });

  // Incoming offers on editions the user currently holds (the owner's inbox).
  let offersByAcq = {};
  if (acqIds.length) {
    const { data: offers } = await sb
      .from('offers')
      .select('id, acquisition_id, amount, currency, status, created_at')
      .in('acquisition_id', acqIds)
      .eq('status', 'active')
      .order('amount', { ascending: false });
    for (const o of offers ?? []) (offersByAcq[o.acquisition_id] ||= []).push(o);
  }
  for (const c of collection) c.offers = offersByAcq[c.id] ?? [];

  // Offers the user has made elsewhere, so they can pay when accepted / withdraw.
  const { data: myOffersRaw } = await sb
    .from('offers')
    .select('id, amount, currency, status, releases ( title, artist_name )')
    .eq('offerer_id', userId)
    .in('status', ['active', 'accepted'])
    .order('updated_at', { ascending: false });
  const myOffers = (myOffersRaw ?? []).map((o) => ({
    id: o.id,
    amount: o.amount,
    currency: o.currency,
    status: o.status,
    work: `${o.releases?.artist_name ?? ''} — ${o.releases?.title ?? ''}`,
  }));

  // Flat ownership log across the collection (kept for the summary table).
  const events = collection.flatMap((c) =>
    c.living_record.map((ev) => ({
      date: ev.date,
      work: `${c.artist} — ${c.title}`,
      event: ev.kind,
      price: ev.price ?? '—',
    }))
  ).sort((a, b) => (a.date < b.date ? 1 : -1));

  return { collection, events, myOffers };
}
