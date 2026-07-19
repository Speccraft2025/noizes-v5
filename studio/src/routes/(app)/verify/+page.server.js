import { fail, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { validateKycFields, canSubmitKyc, safeFileExt, ID_TYPES } from '$lib/server/kyc.js';

export async function load({ locals, url }) {
  if (!locals.user) {
    throw redirect(303, `/auth/login?next=${encodeURIComponent(url.pathname)}`);
  }
  const p = locals.profile ?? {};
  return {
    kyc: {
      status: p.kyc_status ?? 'unverified',
      submitted_at: p.kyc_submitted_at ?? null,
      reject_reason: p.kyc_reject_reason ?? null,
    },
    idTypes: ID_TYPES,
  };
}

export const actions = {
  submit: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated.' });

    // Never clobber a submission under review or an approved verification.
    if (!canSubmitKyc(locals.profile?.kyc_status)) {
      return fail(400, { error: 'Your verification is already submitted or approved.' });
    }

    const form = await request.formData();
    const full_name = form.get('full_name')?.toString().trim();
    const country   = form.get('country')?.toString().trim();
    const id_type   = form.get('id_type')?.toString();
    const id_number = form.get('id_number')?.toString().trim();
    const idDoc     = form.get('id_document');
    const selfie    = form.get('selfie');

    const fieldError = validateKycFields({ full_name, country, id_type, id_number });
    if (fieldError) return fail(400, { error: fieldError });

    if (!idDoc || idDoc.size === 0) return fail(400, { error: 'ID document photo is required.' });
    if (!selfie || selfie.size === 0) return fail(400, { error: 'Selfie photo is required.' });
    // Netlify caps request bodies at 6MB — reject early with a clear message
    // instead of letting the platform 502.
    if (idDoc.size + selfie.size > 5 * 1024 * 1024) {
      return fail(400, { error: 'Photos are too large — keep both under 5MB combined.' });
    }

    const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const basePath = `${locals.user.id}/${Date.now()}`;

    const id_document_path = `${basePath}/id.${safeFileExt(idDoc.name)}`;
    const { error: e1 } = await sb.storage.from('kyc-documents').upload(id_document_path, idDoc, { contentType: idDoc.type, upsert: true });
    if (e1) return fail(500, { error: `ID document upload failed: ${e1.message}` });

    const selfie_path = `${basePath}/selfie.${safeFileExt(selfie.name)}`;
    const { error: e2 } = await sb.storage.from('kyc-documents').upload(selfie_path, selfie, { contentType: selfie.type, upsert: true });
    if (e2) return fail(500, { error: `Selfie upload failed: ${e2.message}` });

    const now = new Date().toISOString();

    const { error: subErr } = await sb.from('kyc_submissions').insert({
      user_id: locals.user.id,
      full_name, country, id_type, id_number,
      id_document_path, selfie_path,
      status: 'pending',
      submitted_at: now,
    });
    if (subErr) return fail(500, { error: `Submission failed: ${subErr.message}` });

    const { error: profErr } = await sb.from('profiles').update({
      kyc_status: 'pending',
      kyc_full_name: full_name,
      kyc_country: country,
      kyc_id_type: id_type,
      kyc_id_number: id_number,
      kyc_id_document_path: id_document_path,
      kyc_selfie_path: selfie_path,
      kyc_submitted_at: now,
      kyc_reject_reason: null,
    }).eq('id', locals.user.id);
    if (profErr) return fail(500, { error: `Profile update failed: ${profErr.message}` });

    return { submitted: true };
  }
};
