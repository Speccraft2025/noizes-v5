import { createHash } from 'node:crypto';
import { Resend } from 'resend';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function resendInviteConfigured(env = {}) {
  return Boolean(String(env.RESEND_API_KEY || '').trim() && String(env.RESEND_FROM_EMAIL || '').trim());
}

export function buildCollaboratorInviteEmail({
  collaboratorName,
  inviterName,
  creditRole,
  trackCount = 0,
  actionLink,
}) {
  const safeCollaboratorName = escapeHtml(collaboratorName);
  const safeInviterName = escapeHtml(inviterName);
  const safeCreditRole = escapeHtml(creditRole);
  const safeActionLink = escapeHtml(actionLink);
  const linkedTracks = Number(trackCount) > 0
    ? `${Number(trackCount)} ${Number(trackCount) === 1 ? 'track' : 'tracks'}`
    : 'the release';
  const safeLinkedTracks = escapeHtml(linkedTracks);
  const subject = `${inviterName} invited you to create on Noizes`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#050505;color:#f7f5ff;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #33245f;border-radius:20px;background:#0c0912;overflow:hidden;">
          <tr><td style="padding:32px 36px 12px;color:#8b5cf6;font-size:28px;font-weight:900;letter-spacing:3px;">NOIZES</td></tr>
          <tr><td style="padding:12px 36px 4px;font-size:30px;line-height:1.15;font-weight:800;">You’re part of the release.</td></tr>
          <tr><td style="padding:16px 36px 0;color:#c9c3d8;font-size:16px;line-height:1.65;">Hi ${safeCollaboratorName},</td></tr>
          <tr><td style="padding:8px 36px 0;color:#c9c3d8;font-size:16px;line-height:1.65;"><strong style="color:#ffffff;">${safeInviterName}</strong> credited you as <strong style="color:#ffffff;">${safeCreditRole}</strong> on ${safeLinkedTracks} and invited you to join the release in Noizes Studio.</td></tr>
          <tr><td style="padding:28px 36px;">
            <a href="${safeActionLink}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#536dfe);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">Accept invitation</a>
          </td></tr>
          <tr><td style="padding:0 36px 32px;color:#777184;font-size:13px;line-height:1.55;">This invitation is linked to your email address. If you weren’t expecting it, you can ignore this message.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${collaboratorName},`,
    '',
    `${inviterName} credited you as ${creditRole} on ${linkedTracks} and invited you to join the release in Noizes Studio.`,
    '',
    `Accept invitation: ${actionLink}`,
    '',
    'This invitation is linked to your email address. If you were not expecting it, you can ignore this message.',
  ].join('\n');

  return { subject, html, text };
}

export function buildWaitlistInviteEmail({ role, actionLink }) {
  const safeActionLink = escapeHtml(actionLink);
  const safeRole = escapeHtml(role);
  const subject = `You're in — welcome to Noizes`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#050505;color:#f7f5ff;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #33245f;border-radius:20px;background:#0c0912;overflow:hidden;">
          <tr><td style="padding:32px 36px 12px;color:#8b5cf6;font-size:28px;font-weight:900;letter-spacing:3px;">NOIZES</td></tr>
          <tr><td style="padding:12px 36px 4px;font-size:30px;line-height:1.15;font-weight:800;">You're off the waitlist.</td></tr>
          <tr><td style="padding:16px 36px 0;color:#c9c3d8;font-size:16px;line-height:1.65;">You signed up as a <strong style="color:#ffffff;">${safeRole}</strong> and your spot is ready. Accept below to set your password and get started.</td></tr>
          <tr><td style="padding:28px 36px;">
            <a href="${safeActionLink}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#536dfe);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">Accept invitation</a>
          </td></tr>
          <tr><td style="padding:0 36px 32px;color:#777184;font-size:13px;line-height:1.55;">This invitation is linked to your email address. If you weren't expecting it, you can ignore this message.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `You're off the waitlist!`,
    '',
    `You signed up as a ${role} and your spot is ready. Accept below to set your password and get started.`,
    '',
    `Accept invitation: ${actionLink}`,
    '',
    'This invitation is linked to your email address. If you were not expecting it, you can ignore this message.',
  ].join('\n');

  return { subject, html, text };
}

export async function sendResendEmail({
  apiKey,
  from,
  replyTo = '',
  to,
  subject,
  html,
  text,
  idempotencySeed,
  resendClient = null,
}) {
  if (!String(apiKey || '').trim() || !String(from || '').trim()) {
    throw new Error('Resend is not configured.');
  }

  const idempotencyKey = `noizes-${createHash('sha256').update(String(idempotencySeed)).digest('hex')}`;
  const email = { from, to: [to], subject, html, text };
  if (String(replyTo || '').trim()) email.replyTo = replyTo;

  const resend = resendClient || new Resend(apiKey);
  const { data, error } = await resend.emails.send(email, { idempotencyKey });
  if (error) throw new Error(error.message || 'Resend could not deliver the email.');
  if (!data?.id) throw new Error('Resend accepted the request without returning an email ID.');
  return { id: data.id };
}
