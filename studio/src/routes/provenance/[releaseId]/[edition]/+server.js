import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { loadChain, verifyChain, buildProvenanceDocument } from '$lib/server/provenance.js';
import { getRegistryPublicKey } from '$lib/server/signing.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public: exports the signed, hash-chained provenance for one edition as a
// downloadable provenance.json. Anyone can verify it offline against the
// embedded registry public key — this is what makes an object's history
// survive independently of Noizes. Edition "open" means an unnumbered edition.
export async function GET({ params }) {
  const { releaseId } = params;
  if (!UUID_RE.test(releaseId || '')) throw error(400, 'Bad release id');
  const editionNumber = params.edition === 'open' ? null : Number(params.edition);
  if (params.edition !== 'open' && !Number.isInteger(editionNumber)) {
    throw error(400, 'Edition must be a number or "open"');
  }

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: release } = await sb
    .from('releases')
    .select('id, title, artist_name, edition_size')
    .eq('id', releaseId)
    .maybeSingle();
  if (!release) throw error(404, 'Release not found');

  const events = await loadChain(sb, releaseId, editionNumber);
  if (events.length === 0) throw error(404, 'No provenance recorded for this edition yet');

  const check = verifyChain(events);
  if (!check.valid) {
    // A stored chain that fails verification is a serious integrity problem —
    // do not hand out a document we can't stand behind.
    console.error(`[provenance] chain invalid for ${releaseId}#${params.edition}: ${check.errors.join('; ')}`);
    throw error(500, 'Provenance integrity check failed');
  }

  const registryPublicKey = await getRegistryPublicKey(sb);
  const doc = buildProvenanceDocument({ release, editionNumber, events, registryPublicKey });

  const label = params.edition === 'open' ? 'open' : `${editionNumber}`;
  const filename = `provenance_${release.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_ed${label}.json`;

  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
