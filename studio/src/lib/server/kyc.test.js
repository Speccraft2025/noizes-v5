import { describe, it, expect } from 'vitest';
import { validateKycFields, canSubmitKyc, safeFileExt, ID_TYPES } from './kyc.js';

const valid = { full_name: 'Jazel Isaac', country: 'Kenya', id_type: 'national_id', id_number: '12345678' };

describe('validateKycFields', () => {
  it('accepts a valid submission', () => {
    expect(validateKycFields(valid)).toBeNull();
  });

  it('accepts every declared ID type', () => {
    for (const id_type of ID_TYPES) {
      expect(validateKycFields({ ...valid, id_type })).toBeNull();
    }
  });

  it('rejects missing or too-short name', () => {
    expect(validateKycFields({ ...valid, full_name: '' })).toMatch(/name/i);
    expect(validateKycFields({ ...valid, full_name: 'J' })).toMatch(/name/i);
  });

  it('rejects overlong fields', () => {
    expect(validateKycFields({ ...valid, full_name: 'x'.repeat(201) })).toMatch(/long/i);
    expect(validateKycFields({ ...valid, country: 'x'.repeat(101) })).toMatch(/long/i);
    expect(validateKycFields({ ...valid, id_number: 'x'.repeat(51) })).toMatch(/long/i);
  });

  it('rejects missing country and id_number', () => {
    expect(validateKycFields({ ...valid, country: '' })).toMatch(/country/i);
    expect(validateKycFields({ ...valid, id_number: '' })).toMatch(/id number/i);
  });

  it('rejects unknown id types', () => {
    expect(validateKycFields({ ...valid, id_type: 'library_card' })).toMatch(/id type/i);
    expect(validateKycFields({ ...valid, id_type: undefined })).toMatch(/id type/i);
  });

  it('handles a missing payload without throwing', () => {
    expect(validateKycFields()).toMatch(/name/i);
  });
});

describe('canSubmitKyc', () => {
  it('allows unverified and rejected (resubmission)', () => {
    expect(canSubmitKyc('unverified')).toBe(true);
    expect(canSubmitKyc('rejected')).toBe(true);
    expect(canSubmitKyc(null)).toBe(true);      // profile not yet loaded → default
    expect(canSubmitKyc(undefined)).toBe(true);
  });

  it('blocks pending and approved', () => {
    expect(canSubmitKyc('pending')).toBe(false);
    expect(canSubmitKyc('approved')).toBe(false);
  });
});

describe('safeFileExt', () => {
  it('extracts normal extensions', () => {
    expect(safeFileExt('photo.jpg')).toBe('jpg');
    expect(safeFileExt('IMG_2041.JPEG')).toBe('jpeg');
    expect(safeFileExt('scan.tar.png')).toBe('png');
  });

  it('falls back to bin for missing or hostile names', () => {
    expect(safeFileExt('noextension')).toBe('bin');
    expect(safeFileExt('')).toBe('bin');
    expect(safeFileExt(undefined)).toBe('bin');
    expect(safeFileExt('shot.superlongext')).toBe('bin');
  });

  it('strips path/traversal characters from the extension', () => {
    // Whatever survives must be pure lowercase alphanumeric — no dots/slashes.
    expect(safeFileExt('id.p/../ng')).toMatch(/^[a-z0-9]{1,5}$/);
    expect(safeFileExt('x.j%pg')).toBe('jpg');
    expect(safeFileExt('evil.<script>')).toMatch(/^[a-z0-9]{1,5}$|^bin$/);
  });
});
