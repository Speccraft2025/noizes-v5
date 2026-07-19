import { fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export async function load({ locals }) {
  const sb = locals.supabase;
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

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role, display_name: email.split('@')[0] },
      redirectTo: `https://noizes.xyz/auth/callback`
    });

    if (error) {
      // "Already registered" isn't a failure of access — the account exists
      // and the invite row (incl. any role change) stands. No email goes out,
      // which is fine: they can already sign in.
      if (/already.{0,30}(registered|exists)/i.test(error.message)) {
        return { invited: email, alreadyRegistered: true };
      }
      // Genuine send failure: don't leave a brand-new invite granting access
      // to an email that never got a mail — but never delete one that
      // pre-existed this action.
      if (!existingInvite) {
        await adminClient.from('invites').delete().eq('email', email);
      }
      return fail(500, { inviteError: error.message, failedEmail: email });
    }

    return { invited: email };
  },

  delete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    if (!id) return fail(400, { error: 'ID required.' });
    await locals.supabase.from('waitlist').delete().eq('id', id);
    return { deleted: true };
  }
};
