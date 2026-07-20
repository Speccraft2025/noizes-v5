import { describe, it, expect } from 'vitest';
import {
  validateKycFields, validateKycImage, parseLinks, canSubmitKyc, safeFileExt,
  ID_TYPES, YEARS_ACTIVE, REJECT_REASONS,
} from './kyc.js';

const valid = {
  full_name: 'Jazel Isaac', country: 'Kenya', id_type: 'national_id', id_number: '12345678',
  artist_name: "Jazel 'dBoy' Isaac", years_active: '3-5',
};

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

  it('requires artist name and a valid years-active bucket', () => {
    expect(validateKycFields({ ...valid, artist_name: '' })).toMatch(/artist/i);
    expect(validateKycFields({ ...valid, artist_name: 'x'.repeat(101) })).toMatch(/artist/i);
    expect(validateKycFields({ ...valid, years_active: 'forever' })).toMatch(/active/i);
    expect(validateKycFields({ ...valid, years_active: undefined })).toMatch(/active/i);
    for (const y of YEARS_ACTIVE) {
      expect(validateKycFields({ ...valid, years_active: y })).toBeNull();
    }
  });
});

describe('validateKycImage', () => {
  const img = (name, type, size = 1000) => ({ name, type, size });

  it('accepts browser-renderable formats', () => {
    expect(validateKycImage(img('id.jpg', 'image/jpeg'), 'ID photo')).toBeNull();
    expect(validateKycImage(img('id.JPEG', 'image/jpeg'), 'ID photo')).toBeNull();
    expect(validateKycImage(img('shot.png', 'image/png'), 'Selfie')).toBeNull();
    expect(validateKycImage(img('shot.webp', 'image/webp'), 'Selfie')).toBeNull();
  });

  it('rejects HEIC with an iPhone-specific message', () => {
    const err = validateKycImage(img('selfie.heic', 'image/heic'), 'Selfie');
    expect(err).toMatch(/HEIC/);
    expect(err).toMatch(/iPhone/);
  });

  it('rejects non-image and mismatched files', () => {
    expect(validateKycImage(img('doc.pdf', 'application/pdf'), 'ID photo')).toMatch(/JPG, PNG or WebP/);
    expect(validateKycImage(img('id.jpg', 'application/octet-stream'), 'ID photo')).toMatch(/JPG, PNG or WebP/);
    expect(validateKycImage(img('id.exe', 'image/jpeg'), 'ID photo')).toMatch(/JPG, PNG or WebP/);
  });

  it('rejects missing or empty files', () => {
    expect(validateKycImage(null, 'Selfie')).toMatch(/required/);
    expect(validateKycImage(img('x.jpg', 'image/jpeg', 0), 'Selfie')).toMatch(/required/);
  });
});

describe('parseLinks', () => {
  it('parses one link per line and normalizes to https', () => {
    const { links, error } = parseLinks('open.spotify.com/artist/abc\nhttps://youtube.com/@dboy');
    expect(error).toBeNull();
    expect(links).toEqual(['https://open.spotify.com/artist/abc', 'https://youtube.com/@dboy']);
  });

  it('accepts commas as separators and dedupes', () => {
    const { links } = parseLinks('https://a.com/x, https://a.com/x');
    expect(links).toEqual(['https://a.com/x']);
  });

  it('returns [] for empty input (optional fields)', () => {
    expect(parseLinks('').links).toEqual([]);
    expect(parseLinks(null).links).toEqual([]);
  });

  it('rejects garbage, overlong, and too many links', () => {
    expect(parseLinks('not a url at all', { label: 'Music links' }).error).toMatch(/Music links/);
    expect(parseLinks(`https://a.com/${'x'.repeat(300)}`).error).toMatch(/long/i);
    expect(parseLinks(Array.from({ length: 6 }, (_, i) => `https://a.com/${i}`).join('\n')).error).toMatch(/at most 5/);
  });

  it('rejects non-http protocols', () => {
    expect(parseLinks('javascript:alert(1)').error).toBeTruthy();
    expect(parseLinks('ftp://files.example.com').error).toBeTruthy();
  });
});

describe('REJECT_REASONS', () => {
  it('is a non-empty list of short artist-readable strings', () => {
    expect(REJECT_REASONS.length).toBeGreaterThanOrEqual(5);
    for (const r of REJECT_REASONS) {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(10);
      expect(r.length).toBeLessThanOrEqual(300);
    }
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
