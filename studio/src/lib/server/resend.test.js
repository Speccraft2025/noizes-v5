import { describe, expect, it, vi } from 'vitest';
import { buildCollaboratorInviteEmail, buildWaitlistInviteEmail, resendInviteConfigured, sendResendEmail } from './resend.js';

describe('Resend collaborator invitations', () => {
  it('builds a branded invite while escaping dynamic HTML', () => {
    const email = buildCollaboratorInviteEmail({
      collaboratorName: '<Guest>',
      inviterName: 'Jazel & Co',
      creditRole: 'Artist <Featured>',
      trackCount: 2,
      actionLink: 'https://example.com/accept?next="studio"&token=abc',
    });

    expect(email.subject).toBe('Jazel & Co invited you to create on Noizes');
    expect(email.html).toContain('Jazel &amp; Co');
    expect(email.html).toContain('Artist &lt;Featured&gt;');
    expect(email.html).toContain('next=&quot;studio&quot;&amp;token=abc');
    expect(email.html).not.toContain('<Guest>');
    expect(email.text).toContain('on 2 tracks');
  });

  it('builds a branded waitlist invite email', () => {
    const email = buildWaitlistInviteEmail({
      role: 'collector',
      actionLink: 'https://noizes.xyz/auth/confirm?token_hash=abc123',
    });

    expect(email.subject).toBe("You're in — welcome to Noizes");
    expect(email.html).toContain('collector');
    expect(email.html).toContain('token_hash=abc123');
    expect(email.html).toContain('NOIZES');
    expect(email.text).toContain('collector');
    expect(email.text).toContain('https://noizes.xyz/auth/confirm?token_hash=abc123');
  });

  it('escapes HTML in waitlist invite role', () => {
    const email = buildWaitlistInviteEmail({
      role: '<script>alert("xss")</script>',
      actionLink: 'https://noizes.xyz/auth/confirm?token_hash=abc',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('requires both Resend configuration values', () => {
    expect(resendInviteConfigured({ RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'Noizes <hello@example.com>' })).toBe(true);
    expect(resendInviteConfigured({ RESEND_API_KEY: 're_test' })).toBe(false);
  });

  it('sends through the Resend SDK with a stable idempotency key', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const resendClient = { emails: { send } };

    await expect(sendResendEmail({
      apiKey: 're_test',
      from: 'Noizes <collaborate@noizes.xyz>',
      replyTo: 'team@noizes.xyz',
      to: 'guest@example.com',
      subject: 'Invitation',
      html: '<p>Join</p>',
      text: 'Join',
      idempotencySeed: 'credit-id:guest@example.com',
      resendClient,
    })).resolves.toEqual({ id: 'email_123' });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({
      from: 'Noizes <collaborate@noizes.xyz>',
      to: ['guest@example.com'],
      replyTo: 'team@noizes.xyz',
    });
    expect(send.mock.calls[0][1].idempotencyKey).toMatch(/^noizes-[a-f0-9]{64}$/);
  });

  it('surfaces a Resend API failure', async () => {
    const resendClient = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Sender domain is not verified', statusCode: 422, name: 'validation_error' },
        }),
      },
    };

    await expect(sendResendEmail({
      apiKey: 're_test',
      from: 'Noizes <collaborate@example.com>',
      to: 'guest@example.com',
      subject: 'Invitation',
      html: '<p>Join</p>',
      text: 'Join',
      idempotencySeed: 'credit-id:guest@example.com',
      resendClient,
    })).rejects.toThrow('Sender domain is not verified');
  });
});
