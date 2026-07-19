import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Route access is admin-gated in hooks. All reads/writes use the service role:
// kyc-documents is a private bucket (signed URLs only), and submissions span
// all users.
const adminClient = () => createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function load() {
  const sb = adminClient();

  const { data: submissions } = await sb
    .from('kyc_submissions')
    .select('id, user_id, full_name, country, id_type, id_number, id_document_path, selfie_path, status, reject_reason, submitted_at, reviewed_at')
    .order('submitted_at', { ascending: false })
    .limit(50);

  const rows = submissions ?? [];

  // Resolve emails + signed URLs (1h) for the private documents.
  const userIds = [...new Set(rows.map(s => s.user_id))];
  const { data: profiles } = userIds.length
    ? await sb.from('profiles').select('id, email, kyc_status').in('id', userIds)
    : { data: [] };
  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  const withUrls = await Promise.all(rows.map(async (s) => {
    const sign = async (path) => {
      if (!path) return null;
      const { data } = await sb.storage.from('kyc-documents').createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    };
    return {
      ...s,
      email: byId[s.user_id]?.email ?? '(deleted user)',
      profile_kyc_status: byId[s.user_id]?.kyc_status ?? null,
      id_document_url: await sign(s.id_document_path),
      selfie_url: await sign(s.selfie_path),
    };
  }));

  return {
    submissions: withUrls,
    pendingCount: withUrls.filter(s => s.status === 'pending').length,
  };
}

async function review({ request, locals }, decision) {
  const form = await request.formData();
  const id = form.get('id')?.toString();
  const reject_reason = form.get('reject_reason')?.toString().trim() || null;

  if (!UUID_RE.test(id || '')) return fail(400, { error: 'Submission id required.' });
  if (decision === 'rejected' && !reject_reason) {
    return fail(400, { error: 'A reject reason is required — the artist sees it on /verify.' });
  }

  const sb = adminClient();
  const now = new Date().toISOString();

  // Only review pending submissions — a second click or a stale tab must not
  // overwrite a decision that already happened.
  const { data: sub, error: subErr } = await sb
    .from('kyc_submissions')
    .update({ status: decision, reviewer_id: locals.user.id, reject_reason, reviewed_at: now })
    .eq('id', id)
    .eq('status', 'pending')
    .select('user_id')
    .maybeSingle();
  if (subErr) return fail(500, { error: subErr.message });
  if (!sub) return fail(409, { error: 'Submission already reviewed (or not found).' });

  const { error: profErr } = await sb
    .from('profiles')
    .update({
      kyc_status: decision,
      kyc_reviewed_at: now,
      kyc_reviewer_id: locals.user.id,
      kyc_reject_reason: decision === 'rejected' ? reject_reason : null,
    })
    .eq('id', sub.user_id);
  if (profErr) {
    return fail(500, { error: `Submission updated but profile update failed: ${profErr.message} — fix profiles.kyc_status for user ${sub.user_id} manually.` });
  }

  return { reviewed: decision };
}

export const actions = {
  approve: (event) => review(event, 'approved'),
  reject:  (event) => review(event, 'rejected'),
};
