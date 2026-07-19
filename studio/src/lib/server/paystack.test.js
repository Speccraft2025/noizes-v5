import { describe, it, expect, vi, afterEach } from 'vitest';
import nodeCrypto from 'node:crypto';
import { makeReference, toSubunits, verifyPaystackSignature, initializeTransaction, verifyTransaction } from './paystack.js';

describe('makeReference', () => {
  it('produces an nz_-prefixed uuid', () => {
    expect(makeReference()).toMatch(/^nz_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('is unique across calls', () => {
    const refs = new Set(Array.from({ length: 100 }, makeReference));
    expect(refs.size).toBe(100);
  });
});

describe('toSubunits', () => {
  it('converts whole KES to cents', () => {
    expect(toSubunits(1500, 'KES')).toBe(150000);
  });

  it('converts decimal prices without float drift', () => {
    expect(toSubunits(99.99, 'KES')).toBe(9999);
    expect(toSubunits('19.9', 'KES')).toBe(1990);
  });

  it('passes zero through (caller decides zero-price policy)', () => {
    expect(toSubunits(0, 'KES')).toBe(0);
  });

  it('throws on negative prices', () => {
    expect(() => toSubunits(-5, 'KES')).toThrow(/Invalid price/);
  });

  it('throws on non-numeric prices', () => {
    expect(() => toSubunits('free', 'KES')).toThrow(/Invalid price/);
    expect(() => toSubunits(NaN, 'KES')).toThrow(/Invalid price/);
  });

  it('throws on unsupported currencies', () => {
    expect(() => toSubunits(10, 'USD')).toThrow(/Unsupported currency/);
    expect(() => toSubunits(10, 'EUR')).toThrow(/Unsupported currency/);
  });
});

describe('verifyPaystackSignature', () => {
  const secret = 'sk_test_secret';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'nz_x' } });
  const sign = (b, s) => nodeCrypto.createHmac('sha512', s).update(b).digest('hex');

  it('accepts a valid signature', () => {
    expect(verifyPaystackSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyPaystackSignature(body + 'x', sign(body, secret), secret)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(verifyPaystackSignature(body, sign(body, 'sk_other'), secret)).toBe(false);
  });

  it('rejects a missing header without throwing', () => {
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, '', secret)).toBe(false);
  });

  it('rejects a short/garbage header without throwing (timingSafeEqual length guard)', () => {
    expect(verifyPaystackSignature(body, 'abc', secret)).toBe(false);
  });

  it('rejects when the secret is missing', () => {
    expect(verifyPaystackSignature(body, sign(body, secret), '')).toBe(false);
  });
});

// The happy path of these wrappers was verified live against the real
// Paystack API; these cover the error-classification branches of
// paystackFetch, which a live test can't deterministically trigger.
describe('paystackFetch error handling (via initializeTransaction / verifyTransaction)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const okJson = (data) => ({ ok: true, statusText: 'OK', json: async () => ({ status: true, data }) });

  it('sends auth header + JSON body and unwraps .data on success', async () => {
    let captured;
    vi.stubGlobal('fetch', async (url, init) => { captured = { url, init }; return okJson({ authorization_url: 'https://checkout.paystack.com/x', reference: 'nz_r' }); });
    const data = await initializeTransaction('sk_test_k', { email: 'a@b.c', amount: 150000, currency: 'KES', reference: 'nz_r' });
    expect(data.authorization_url).toBe('https://checkout.paystack.com/x');
    expect(captured.url).toBe('https://api.paystack.co/transaction/initialize');
    expect(captured.init.method).toBe('POST');
    expect(captured.init.headers.Authorization).toBe('Bearer sk_test_k');
    expect(JSON.parse(captured.init.body)).toMatchObject({ amount: 150000, currency: 'KES', reference: 'nz_r' });
  });

  it('throws with the Paystack message on an HTTP error', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, statusText: 'Unauthorized', json: async () => ({ status: false, message: 'Invalid key' }) }));
    await expect(verifyTransaction('sk_bad', 'nz_r')).rejects.toThrow(/Invalid key/);
  });

  it('throws when Paystack replies 200 but status:false', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, statusText: 'OK', json: async () => ({ status: false, message: 'Transaction not found' }) }));
    await expect(verifyTransaction('sk_test_k', 'nz_missing')).rejects.toThrow(/Transaction not found/);
  });

  it('falls back to statusText when the body is not JSON', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, statusText: 'Bad Gateway', json: async () => { throw new Error('not json'); } }));
    await expect(verifyTransaction('sk_test_k', 'nz_r')).rejects.toThrow(/Bad Gateway/);
  });

  it('URL-encodes the reference on verify', async () => {
    let captured;
    vi.stubGlobal('fetch', async (url) => { captured = url; return okJson({ status: 'success' }); });
    await verifyTransaction('sk_test_k', 'nz_a/b?c');
    expect(captured).toBe('https://api.paystack.co/transaction/verify/nz_a%2Fb%3Fc');
  });
});
