import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { buildInviteAcceptanceUrl, isExistingSupabaseUserError } from '$lib/server/collaborator-invites.js';
import { buildWaitlistInviteEmail, resendInviteConfigured, sendResendEmail } from '$lib/server/resend.js';

export async function load({ locals }) {
  const sb = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: entries } = await sb
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });

  // public.invites is the source of truth for who has been let in — a profile
  // row only appears once the invite is accepted, so it under-reports.
  const { data: invites } = await sb.from('invites').select('email');
  const invitedEmails = new Set((invites ?? []).map(i => i.email));

  return {
    entries: (entries ?? []).map(e => ({ ...e, invited: invitedEmails.has(e.email?.toLowerCase()) }))
  };
}

export const actions = {
  invite: async ({ request, locals }) => {
    const form = await request.formData();
    const email = form.get('email')?.toString().trim().toLowerCase();
    const role  = form.get('role')?.toString() || 'collector';

    if (!email) return fail(400, { error: 'Email required.' });
    if (!['creator', 'collector'].includes(role)) return fail(400, { error: 'Invalid role.' });

    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Remember whether this email was already invited: rollback must never
    // delete a pre-existing invite (that would sign out and lock out an
    // active user — the hooks invite check tears down their session).
    const { data: existingInvite } = await adminClient
      .from('invites')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    // Record the invite FIRST. The require_invite_for_new_user trigger on
    // auth.users rejects any insert for an email that is not on this list —
    // including this one — so the row has to exist before inviteUserByEmail.
    const { error: inviteRowError } = await adminClient
      .from('invites')
      .upsert({ email, role, invited_by: locals.user?.id ?? null }, { onConflict: 'email' });

    if (inviteRowError) return fail(500, { inviteError: inviteRowError.message, failedEmail: email });

    const metadata = { role, display_name: email.split('@')[0] };
    const useResend = resendInviteConfigured(env);
    let inviteErr = null;

    if (useResend) {
      const { data, error: genErr } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { data: metadata },
      });
      inviteErr = genErr;

      if (!inviteErr) {
        const tokenHash = data?.properties?.hashed_token;
        try {
          if (!tokenHash) throw new Error('Supabase did not generate an invitation token.');
          const actionLink = buildInviteAcceptanceUrl('https://noizes.xyz', tokenHash);
          const tpl = buildWaitlistInviteEmail({ role, actionLink });
          await sendResendEmail({
            apiKey: env.RESEND_API_KEY,
            from: env.RESEND_FROM_EMAIL,
            replyTo: env.RESEND_REPLY_TO,
            to: email,
            ...tpl,
            idempotencySeed: `waitlist:${email}:${tokenHash}`,
          });
        } catch (resendErr) {
          if (!existingInvite && data?.user?.id) await adminClient.auth.admin.deleteUser(data.user.id);
          if (!existingInvite) await adminClient.from('invites').delete().eq('email', email);
          return fail(500, { inviteError: resendErr.message, failedEmail: email });
        }
      }
    } else {
      const { error: sbErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        redirectTo: `https://noizes.xyz/auth/callback`,
      });
      inviteErr = sbErr;
    }

    if (inviteErr) {
      if (isExistingSupabaseUserError(inviteErr.message)) {
        return { invited: email, alreadyRegistered: true };
      }
      if (!existingInvite) {
        await adminClient.from('invites').delete().eq('email', email);
      }
      return fail(500, { inviteError: inviteErr.message, failedEmail: email });
    }

    return { invited: email };
  },

  delete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return fail(400, { error: 'ID required.' });
    const adminClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await adminClient.from('waitlist').delete().eq('id', id);
    return { deleted: true };
  }
};
