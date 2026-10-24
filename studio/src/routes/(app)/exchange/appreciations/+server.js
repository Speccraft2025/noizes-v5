import { getSupabaseServiceRoleClient } from '#lib/server/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ locals, request }) {
  const user = locals.user;
  if (!user) return Response.json({ message: 'Sign in to appreciate this release.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'This appreciation request could not be read.' }, { status: 400 });
  }
  const releaseId = String(body?.release_id ?? '');
  const appreciated = body?.appreciated;
  if (!UUID.test(releaseId) || typeof appreciated !== 'boolean') {
    return Response.json({ message: 'This appreciation request is invalid.' }, { status: 400 });
  }

  const admin = getSupabaseServiceRoleClient();
  if (appreciated) {
    const { data: release, error: releaseError } = await admin
      .from('releases')
      .select('id')
      .eq('id', releaseId)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('withdrawn_at', null)
      .not('slug', 'is', null)
      .not('artist_slug', 'is', null)
      .maybeSingle();
    if (releaseError) {
      console.error('[exchange] appreciation eligibility check failed:', releaseError);
      return Response.json({ message: 'Appreciation is temporarily unavailable.' }, { status: 503 });
    }
    if (!release) return Response.json({ message: 'This release is no longer available to appreciate.' }, { status: 409 });
  }

  // The user ID comes from the server-verified Supabase session, never from
  // request JSON. The session client and RLS both enforce ownership.
  const table = locals.supabase.from('release_appreciations');
  const result = appreciated
    ? await table.upsert({ user_id: user.id, release_id: releaseId, appreciated: true }, {
      onConflict: 'user_id,release_id',
    }).select('appreciated').single()
    : await table.update({ appreciated: false })
      .eq('user_id', user.id).eq('release_id', releaseId).eq('appreciated', true)
      .select('appreciated').maybeSingle();

  if (result.error) {
    if (result.error.code === 'P0001') {
      return Response.json({ message: 'Please wait a moment before changing your appreciation.' }, { status: 429 });
    }
    if (result.error.code === '42501') {
      return Response.json({ message: 'This appreciation could not be recorded for your account.' }, { status: 403 });
    }
    console.error('[exchange] appreciation write failed:', result.error);
    return Response.json({ message: 'Appreciation could not be saved. Please try again.' }, { status: 503 });
  }

  const confirmed = result.data?.appreciated ?? false;
  const { data: counts, error: countError } = await admin.rpc('exchange_appreciation_counts', {
    p_release_ids: [releaseId],
  });
  if (countError) console.error('[exchange] updated appreciation count failed:', countError);
  const appreciationCount = counts?.[0]?.appreciation_count;
  return Response.json({
    appreciated: confirmed,
    ...(appreciationCount != null && Number.isFinite(Number(appreciationCount))
      ? { appreciation_count: Number(appreciationCount) }
      : {}),
    message: confirmed ? 'Appreciation recorded' : 'Appreciation removed',
  });
}
