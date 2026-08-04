import { describe, it, expect } from 'vitest';
import { encodeQr, qrSvg, overlapsFinder, MAX_QR_BYTES } from './qr.js';

// The encoder is only useful if a scanner can read it back, and "it looks like
// a QR code" is not evidence of that. These tests reverse the encoder — undo
// the mask, walk the placement order, de-interleave the blocks — and assert
// the original bytes come out. That exercises masking, reservation, the
// zigzag, block splitting and padding together, which is where the bugs are.

const EC_M = {
  1: [10, [[1, 16]]],
  2: [16, [[1, 28]]],
  3: [26, [[1, 44]]],
  4: [18, [[2, 32]]],
  5: [24, [[2, 43]]],
  6: [16, [[4, 27]]],
  7: [18, [[4, 31]]],
  8: [22, [[2, 38], [2, 39]]],
  9: [22, [[3, 36], [2, 37]]],
  10: [26, [[4, 43], [1, 44]]],
};

const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/** Rebuild the reservation map so the decoder skips the same modules. */
function reservationMap(version) {
  const size = version * 4 + 17;
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserve = (row, col) => {
    if (row >= 0 && row < size && col >= 0 && col < size) reserved[row][col] = true;
  };

  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) reserve(top + r, left + c);
  }
  for (let i = 0; i < size; i++) {
    reserve(6, i);
    reserve(i, 6);
  }
  const centers = ALIGNMENT[version];
  for (const row of centers) {
    for (const col of centers) {
      if (overlapsFinder(row, col, size)) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) reserve(row + r, col + c);
    }
  }
  reserve(4 * version + 9, 8);
  for (let i = 0; i < 9; i++) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    reserve(8, size - 1 - i);
    reserve(size - 1 - i, 8);
  }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      reserve(row, col);
      reserve(col, row);
    }
  }
  return reserved;
}

/**
 * Read the 15-bit format information back out of the column-8 copy. The five
 * data bits sit in the high end (the low ten are the BCH remainder), and the
 * mask id is the bottom three of those five.
 */
function readFormat(modules, size, copy = 'column') {
  let bits = 0;
  for (let i = 0; i < 15; i++) {
    let bit;
    if (copy === 'column') {
      if (i < 6) bit = modules[i][8];
      else if (i < 8) bit = modules[i + 1][8];
      else bit = modules[size - 15 + i][8];
    } else if (i < 8) bit = modules[8][size - 1 - i];
    else if (i === 8) bit = modules[8][7];
    else bit = modules[8][14 - i];
    if (bit) bits |= 1 << i;
  }
  return bits ^ 0b101010000010010;
}

function readMaskId(modules, size) {
  return (readFormat(modules, size) >> 10) & 0b111;
}

function decode(result) {
  const { modules, size, version } = result;
  const maskId = readMaskId(modules, size);
  const reserved = reservationMap(version);
  const mask = MASKS[maskId];

  const bits = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        const value = mask(row, col) ? !modules[row][col] : modules[row][col];
        bits.push(value ? 1 : 0);
      }
    }
    upward = !upward;
  }

  const codewords = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // Undo the interleave to recover the data blocks in order.
  const [, groups] = EC_M[version];
  const sizes = groups.flatMap(([count, length]) => new Array(count).fill(length));
  const blocks = sizes.map(() => []);
  let index = 0;
  const longest = Math.max(...sizes);
  for (let i = 0; i < longest; i++) {
    for (let b = 0; b < sizes.length; b++) {
      if (i < sizes[b]) blocks[b].push(codewords[index++]);
    }
  }
  const data = blocks.flat();

  // Byte-mode payload: 4-bit mode, then the character count, then the bytes.
  const stream = [];
  for (const byte of data) for (let i = 7; i >= 0; i--) stream.push((byte >> i) & 1);
  const take = (offset, length) => {
    let value = 0;
    for (let i = 0; i < length; i++) value = (value << 1) | stream[offset + i];
    return value;
  };
  const mode = take(0, 4);
  const countBits = version < 10 ? 8 : 16;
  const count = take(4, countBits);
  const bytes = [];
  for (let i = 0; i < count; i++) bytes.push(take(4 + countBits + i * 8, 8));

  return { mode, text: new TextDecoder().decode(Uint8Array.from(bytes)) };
}

describe('encodeQr', () => {
  it('round-trips a short payload through placement, masking and interleaving', () => {
    const result = encodeQr('HELLO');
    expect(result.version).toBe(1);
    expect(result.size).toBe(21);
    const decoded = decode(result);
    expect(decoded.mode).toBe(0b0100);
    expect(decoded.text).toBe('HELLO');
  });

  it('round-trips a realistic Drop Page URL', () => {
    const url = 'https://noizes.xyz/drop/dboy/retrospect';
    const decoded = decode(encodeQr(url));
    expect(decoded.text).toBe(url);
  });

  it('round-trips at a version that needs multiple EC blocks', () => {
    const url = `https://noizes.xyz/drop/black-people/${'the-mixtape-'.repeat(6)}final`;
    const result = encodeQr(url);
    expect(result.version).toBeGreaterThanOrEqual(4);
    expect(decode(result).text).toBe(url);
  });

  it('round-trips at the 16-bit character-count boundary (version 10)', () => {
    const url = `https://noizes.xyz/drop/artist/${'x'.repeat(180)}`;
    const result = encodeQr(url);
    expect(result.version).toBe(10);
    expect(decode(result).text).toBe(url);
  });

  it('places the three finder patterns', () => {
    const { modules, size } = encodeQr('https://noizes.xyz/drop/dboy/retrospect');
    for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      expect(modules[top][left]).toBe(true);          // outer ring corner
      expect(modules[top + 1][left + 1]).toBe(false); // white separator ring
      expect(modules[top + 3][left + 3]).toBe(true);  // solid centre
    }
  });

  it('keeps the timing patterns alternating', () => {
    const { modules, size } = encodeQr('https://noizes.xyz/drop/dboy/retrospect');
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }
  });

  it('writes both format copies identically, so one damaged corner is survivable', () => {
    for (const text of ['HELLO', 'https://noizes.xyz/drop/dboy/retrospect']) {
      const { modules, size } = encodeQr(text);
      expect(readFormat(modules, size, 'column')).toBe(readFormat(modules, size, 'row'));
    }
  });

  it('draws the alignment patterns that sit on the timing row from version 7 up', () => {
    // Version 7 centres are [6, 22, 38]; (6,22) and (22,6) are real patterns,
    // while (6,6), (6,38) and (38,6) are omitted for the finder corners.
    const { modules, version } = encodeQr(`https://noizes.xyz/drop/a/${'b'.repeat(90)}`);
    expect(version).toBe(7);
    expect(modules[6][22]).toBe(true);   // centre
    expect(modules[5][21]).toBe(false);  // light ring
    expect(modules[4][20]).toBe(true);   // dark outer ring
    expect(modules[22][6]).toBe(true);
  });

  it('is deterministic, so a printed code and a rendered one agree', () => {
    const a = encodeQr('https://noizes.xyz/drop/dboy/retrospect');
    const b = encodeQr('https://noizes.xyz/drop/dboy/retrospect');
    expect(a.modules).toEqual(b.modules);
  });

  it('refuses an empty payload rather than emitting an unscannable code', () => {
    expect(() => encodeQr('')).toThrow(/empty/i);
  });

  it('refuses a payload past the version-10 ceiling', () => {
    expect(() => encodeQr('x'.repeat(MAX_QR_BYTES + 1))).toThrow(/too long/i);
  });
});

describe('qrSvg', () => {
  it('emits a square SVG with the mandatory four-module quiet zone', () => {
    const svg = qrSvg('https://noizes.xyz/drop/dboy/retrospect', { moduleSize: 4 });
    const { size } = encodeQr('https://noizes.xyz/drop/dboy/retrospect');
    const expected = (size + 8) * 4;
    expect(svg).toContain(`width="${expected}"`);
    expect(svg).toContain(`height="${expected}"`);
    expect(svg).toContain(`viewBox="0 0 ${expected} ${expected}"`);
  });

  it('paints a light background so a dark page cannot invert the code', () => {
    const svg = qrSvg('https://noizes.xyz/drop/dboy/retrospect');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toMatch(/<path d="M[\d ]/);
  });

  it('carries an accessible label', () => {
    const svg = qrSvg('https://noizes.xyz/drop/dboy/retrospect', { label: 'Scan to open RETROSPECT' });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Scan to open RETROSPECT"');
  });
});
