import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/supabase.js', () => ({
  createSupabaseServerClient: vi.fn(),
  getSupabaseServiceRoleClient: vi.fn(() => ({})),
}));

import { handleError } from './hooks.server.js';

describe('handleError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves expected HTTP error messages without logging them as server failures', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Release not found');

    expect(handleError({
      error,
      event: { url: new URL('https://noizes.test/drop/missing') },
      status: 404,
      message: 'Release not found',
    })).toEqual({ message: 'Release not found' });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs server failures and returns the generic public message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('private backend details');

    expect(handleError({
      error,
      event: { url: new URL('https://noizes.test/exchange') },
      status: 500,
      message: 'Internal Error',
    })).toEqual({ message: 'An error occurred.' });
    expect(log).toHaveBeenCalledWith('[handleError]', '/exchange', 'private backend details');
  });
});
