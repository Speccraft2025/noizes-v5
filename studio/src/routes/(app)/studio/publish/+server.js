import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, 'Not authenticated');

  const form = await request.formData();
  const releaseId = form.get('release_id')?.toString() || crypto.randomUUID();
  const meta = JSON.parse(form.get('meta'));
  const nzFile = form.get('nz');       // the .nz blob
  const coverFile = form.get('cover'); // optional cover image
  const audioFile = form.get('audio'); // optional audio file

  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const basePath = `${locals.user.id}/${releaseId}`;

  let cover_path = null;
  let audio_path = null;
  let nz_path = null;

  if (coverFile && coverFile.size > 0) {
    const ext = coverFile.name.split('.').pop();
    cover_path = `${basePath}/cover.${ext}`;
    const { error: e } = await sb.storage.from('releases').upload(cover_path, coverFile, {
      contentType: coverFile.type,
      upsert: true
    });
    if (e) throw error(500, `Cover upload failed: ${e.message}`);
  }

  if (audioFile && audioFile.size > 0) {
    const ext = audioFile.name.split('.').pop();
    audio_path = `${basePath}/audio.${ext}`;
    const { error: e } = await sb.storage.from('releases').upload(audio_path, audioFile, {
      contentType: audioFile.type,
      upsert: true
    });
    if (e) throw error(500, `Audio upload failed: ${e.message}`);
  }

  if (nzFile && nzFile.size > 0) {
    nz_path = `${basePath}/package.nz`;
    const { error: e } = await sb.storage.from('releases').upload(nz_path, nzFile, {
      contentType: 'application/zip',
      upsert: true
    });
    if (e) throw error(500, `.nz upload failed: ${e.message}`);
  }

  const { data: release, error: dbErr } = await sb
    .from('releases')
    .upsert({
      id: releaseId,
      artist_id: locals.user.id,
      artist_name: meta.artist,
      title: meta.title,
      genre: meta.genre,
      year: meta.year,
      location: meta.location,
      description: meta.description,
      edition_type: meta.edition_type,
      edition_name: meta.edition_name,
      edition_size: meta.edition_size ? parseInt(meta.edition_size) : null,
      price: parseFloat(meta.price) || 0,
      currency: meta.currency,
      cover_path,
      audio_path,
      nz_path,
      status: 'published',
    }, { onConflict: 'id' })
    .select()
    .single();

  if (dbErr) throw error(500, `DB insert failed: ${dbErr.message}`);

  return json({ success: true, release_id: release.id });
}
