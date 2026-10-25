import { getSupabaseServiceRoleClient } from '#lib/server/supabase.js';

function publicCover(admin, release) {
  return release?.cover_path
    ? admin.storage.from('releases').getPublicUrl(release.cover_path).data?.publicUrl ?? null
    : null;
}

export async function GET() {
  const admin = getSupabaseServiceRoleClient();
  const { data, error } = await admin
    .from('acquisitions')
    .select('id, release_id, edition_number, asking_price, currency, listed_at, listing_state, status, accepting_offers, releases!inner(id, artist_name, title, edition_type, edition_name, edition_size, cover_path, slug, artist_slug, visibility, status, withdrawn_at)')
    .eq('accepting_offers', true)
    .eq('status', 'active')
    .in('listing_state', ['offers_open', 'buy_now'])
    .eq('releases.status', 'published')
    .eq('releases.visibility', 'public')
    .is('releases.withdrawn_at', null)
    .order('listed_at', { ascending: false, nullsFirst: false })
    .limit(48);

  if (error) {
    console.error('[exchange] Collector Market listing failed:', error);
    return Response.json({ message: 'Collector Market could not be loaded just now.' }, { status: 503 });
  }

  const listings = (data ?? []).filter((copy) => copy.releases?.slug && copy.releases?.artist_slug).map((copy) => {
    const release = copy.releases;
    return {
      id: copy.id,
      release_id: copy.release_id,
      edition_number: copy.edition_number,
      edition_size: release.edition_size,
      edition_name: release.edition_name || release.edition_type || 'First Edition',
      asking_price: copy.asking_price,
      currency: copy.currency,
      listing_state: copy.listing_state,
      title: release.title,
      artist_name: release.artist_name,
      cover_url: publicCover(admin, release),
      href: `/exchange/copy/${copy.id}`,
    };
  });

  return Response.json({ listings }, { headers: { 'cache-control': 'private, no-store' } });
}
