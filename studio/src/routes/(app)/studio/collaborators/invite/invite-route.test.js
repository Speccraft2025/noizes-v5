import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('./+server.js', import.meta.url), 'utf8');

describe('collaborator invite route configuration', () => {
  it('passes its imported private bindings to the Resend configuration check', () => {
    // There is no ambient `env` object in a SvelteKit route. This guards the
    // ReferenceError that previously made every Save & send invite request 500.
    expect(route).toContain('resendInviteConfigured({ RESEND_API_KEY, RESEND_FROM_EMAIL })');
    expect(route).not.toContain('resendInviteConfigured(env)');
  });
});
