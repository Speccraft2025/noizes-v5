import { error, json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { buildInviteAcceptanceUrl, isExistingSupabaseUserError, validateCollaboratorInvite } from '$lib/server/collaborator-invites.js';
import { buildCollaboratorInviteEmail, resendInviteConfigured, sendResendEmail } from '$lib/server/resend.js';

export async function POST({ request, locals, url }) {
  if (!locals.user || locals.profile?.role !== 'creator') throw error(401, 'A creator account is required.');
  const parsed = validateCollaboratorInvite(await request.json());
  if (!parsed.valid) throw error(400, parsed.message);
  const invite = parsed.value;
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: existingInvite, error: lookupError } = await admin
    .from('invites')
    .select('email')
    .eq('email', invite.email)
    .maybeSingle();
  if (lookupError) throw error(500, `Could not check collaborator access: ${lookupError.message}`);

  const useResend = resendInviteConfigured(env);
  let existingProfile = null;
  if (useResend) {
    const { data: profile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', invite.email)
      .maybeSingle();
    if (profileLookupError) throw error(500, `Could not check the collaborator account: ${profileLookupError.message}`);
    existingProfile = profile;
  }

  // The auth.users gate requires the platform invite row to exist first. The
  // row, rather than editable user metadata, remains the authorization source.
  const { error: rowError } = await admin.from('invites').upsert({
    email: invite.email,
    role: 'creator',
    invited_by: locals.user.id,
  }, { onConflict: 'email' });
  if (rowError) throw error(500, `Could not grant collaborator access: ${rowError.message}`);

  const metadata = {
    role: 'creator',
    display_name: invite.name,
    invited_release_id: invite.release_id,
    invited_credit_id: invite.credit_id,
    invited_credit_role: invite.role,
    invited_track_ids: invite.track_ids,
  };
  const redirectTo = new URL('/auth/callback?next=/studio', url.origin).toString();
  let data = null;
  let inviteError = null;
  let delivery = 'supabase';
  let emailId = null;

  if (useResend) {
    const generated = await admin.auth.admin.generateLink({
      type: 'invite',
      email: invite.email,
      options: { data: metadata },
    });
    data = generated.data;
    inviteError = generated.error;

    if (!inviteError) {
      const tokenHash = data?.properties?.hashed_token;
      try {
        if (!tokenHash) throw new Error('Supabase did not generate an invitation token.');
        const actionLink = buildInviteAcceptanceUrl(url.origin, tokenHash);
        const inviterName = locals.profile?.display_name || locals.user.email?.split('@')[0] || 'A Noizes creator';
        const email = buildCollaboratorInviteEmail({
          collaboratorName: invite.name,
          inviterName,
          creditRole: invite.role,
          trackCount: invite.track_ids.length,
          actionLink,
        });
        const sent = await sendResendEmail({
          apiKey: env.RESEND_API_KEY,
          from: env.RESEND_FROM_EMAIL,
          replyTo: env.RESEND_REPLY_TO,
          to: invite.email,
          ...email,
          idempotencySeed: `${invite.credit_id}:${invite.email}:${tokenHash}`,
        });
        delivery = 'resend';
        emailId = sent.id;
      } catch (resendError) {
        // generateLink creates a new auth user for a new invitation. If the
        // delivery fails, remove only the user created by this request so the
        // creator can retry instead of leaving an unreachable account behind.
        if (!existingProfile && data?.user?.id) await admin.auth.admin.deleteUser(data.user.id);
        if (!existingInvite) await admin.from('invites').delete().eq('email', invite.email);
        throw error(502, `Resend could not deliver the invitation: ${resendError.message}`);
      }
    }
  } else {
    const invited = await admin.auth.admin.inviteUserByEmail(invite.email, {
      data: metadata,
      redirectTo,
    });
    data = invited.data;
    inviteError = invited.error;
  }

  const alreadyRegistered = Boolean(inviteError && isExistingSupabaseUserError(inviteError.message));
  if (inviteError && !alreadyRegistered) {
    if (!existingInvite) await admin.from('invites').delete().eq('email', invite.email);
    throw error(502, `Supabase could not create the invitation: ${inviteError.message}`);
  }

  let collaboratorUserId = data?.user?.id || null;
  if (alreadyRegistered) {
    // The invite table governs account access, while profiles govern which
    // product surface an existing account sees. Promote an invited collector
    // so the Studio guard does not immediately redirect them away.
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({ role: 'creator' })
      .eq('email', invite.email)
      .select('id')
      .maybeSingle();
    if (profileError) throw error(500, `The account exists but Creator access could not be applied: ${profileError.message}`);
    if (!profile) throw error(409, 'The account exists but has no Noizes profile yet. Ask the collaborator to sign in once, then resend the invitation.');
    collaboratorUserId = profile.id;
    delivery = 'existing_account';
  }

  return json({
    invited: invite.email,
    already_registered: alreadyRegistered,
    user_id: collaboratorUserId,
    delivery,
    email_id: emailId,
    invited_at: new Date().toISOString(),
  });
}
