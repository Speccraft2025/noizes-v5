/**
 * A minimal QR encoder, written here rather than pulled in as a dependency.
 *
 * The Drop Page needs exactly one thing from QR: turn a canonical URL into a
 * scannable matrix, server-side, with no runtime download and no third-party
 * code in the path of a page built for sharing. That is a few hundred lines of
 * well-specified arithmetic (ISO/IEC 18004), so it lives here where it can be
 * read and tested, and where a supply-chain problem in an unrelated package
 * cannot reach a page that renders creator-controlled text.
 *
 * Scope, deliberately narrow:
 *   - byte mode only (URLs are ASCII)
 *   - error correction level M (~15% recovery — the usual choice for print)
 *   - versions 1..10, which cover URLs up to 216 bytes
 *
 * Anything longer throws rather than silently producing an unscannable code.
 */

// ── Capacity tables (ISO/IEC 18004 Table 9), level M, versions 1..10 ──────
// [ec codewords per block, [ [block count, data codewords per block], ... ] ]
const EC_M = Object.freeze({
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
});

const ALIGNMENT = Object.freeze({
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
});

export const MAX_QR_BYTES = 216;

// ── GF(256) arithmetic, primitive polynomial 0x11D ────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial of degree `degree`, coefficients high-order first. */
function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed–Solomon remainder: the EC codewords for one block. */
function ecCodewords(data, count) {
  const gen = generatorPoly(count);
  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < count; i++) {
        remainder[i] ^= gfMul(gen[i + 1], factor);
      }
    }
  }
  return remainder;
}

// ── BCH codes for format and version information ─────────────────────────
function bch(value, poly, bits) {
  let out = value << bits;
  const polyBits = 32 - Math.clz32(poly);
  while (32 - Math.clz32(out) >= polyBits) {
    out ^= poly << (32 - Math.clz32(out) - polyBits);
  }
  return (value << bits) | out;
}

/** 15-bit format information for level M and a mask id. */
function formatBits(mask) {
  // Level M is 0b00; the 5-bit input is (level << 3) | mask.
  return bch((0b00 << 3) | mask, 0b10100110111, 10) ^ 0b101010000010010;
}

/** 18-bit version information, required from version 7 upward. */
function versionBits(version) {
  return bch(version, 0b1111100100101, 12);
}

// ── Bit stream ────────────────────────────────────────────────────────────
class BitBuffer {
  constructor() {
    this.bits = [];
  }

  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length() {
    return this.bits.length;
  }
}

/** Smallest version 1..10 whose level-M data capacity holds `byteLength`. */
function chooseVersion(byteLength) {
  for (let version = 1; version <= 10; version++) {
    const [, groups] = EC_M[version];
    const dataCodewords = groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);
    const countBits = version < 10 ? 8 : 16;
    const needed = Math.ceil((4 + countBits + byteLength * 8) / 8);
    if (needed <= dataCodewords) return version;
  }
  throw new Error(`QR payload too long: ${byteLength} bytes exceeds the ${MAX_QR_BYTES}-byte ceiling of version 10-M`);
}

/** Encode the payload into the interleaved final codeword sequence. */
function buildCodewords(bytes, version) {
  const [ecPerBlock, groups] = EC_M[version];
  const dataCodewords = groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4);                                  // byte mode
  buffer.put(bytes.length, version < 10 ? 8 : 16);        // character count
  for (const byte of bytes) buffer.put(byte, 8);

  // Terminator, then pad to a byte boundary, then alternating pad codewords.
  const capacityBits = dataCodewords * 8;
  buffer.put(0, Math.min(4, capacityBits - buffer.length));
  while (buffer.length % 8 !== 0) buffer.bits.push(0);

  const data = [];
  for (let i = 0; i < buffer.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j];
    data.push(byte);
  }
  const PAD = [0xec, 0x11];
  while (data.length < dataCodewords) data.push(PAD[(data.length - buffer.length / 8) % 2]);

  // Split into blocks, compute EC per block, then interleave both.
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const [blockCount, size] of groups) {
    for (let i = 0; i < blockCount; i++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      ecBlocks.push(ecCodewords(block, ecPerBlock));
    }
  }

  const out = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

// ── Matrix construction ───────────────────────────────────────────────────
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

function blankMatrix(size) {
  return {
    modules: Array.from({ length: size }, () => new Array(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
    size,
  };
}

function placeFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= matrix.size || x < 0 || x >= matrix.size) continue;
      const outer = r === 0 || r === 6 || c === 0 || c === 6;
      const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix.modules[y][x] = outer || inner;
      matrix.reserved[y][x] = true;
    }
  }
}

/**
 * True when an alignment centre falls inside one of the three finder corners.
 * Those combinations — and only those — are omitted. An alignment pattern that
 * lands on the timing row IS drawn: its modules coincide with the timing
 * pattern rather than conflicting with it, and skipping it (an easy mistake,
 * because the timing row is already reserved) silently produces a code that no
 * scanner will read from version 7 upward.
 */
export function overlapsFinder(row, col, size) {
  return (row < 8 && col < 8)
    || (row < 8 && col > size - 9)
    || (row > size - 9 && col < 8);
}

function placeAlignment(matrix, version) {
  const centers = ALIGNMENT[version];
  for (const row of centers) {
    for (const col of centers) {
      if (overlapsFinder(row, col, matrix.size)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const ring = Math.max(Math.abs(r), Math.abs(c));
          matrix.modules[row + r][col + c] = ring !== 1;
          matrix.reserved[row + r][col + c] = true;
        }
      }
    }
  }
}

function placeStatic(matrix, version) {
  const size = matrix.size;
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, 0, size - 7);
  placeFinder(matrix, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    const on = i % 2 === 0;
    matrix.modules[6][i] = on;
    matrix.reserved[6][i] = true;
    matrix.modules[i][6] = on;
    matrix.reserved[i][6] = true;
  }

  placeAlignment(matrix, version);

  // Dark module, always set, always at (4*version + 9, 8).
  matrix.modules[4 * version + 9][8] = true;
  matrix.reserved[4 * version + 9][8] = true;

  // Reserve the format information areas.
  for (let i = 0; i < 9; i++) {
    if (!matrix.reserved[8][i]) { matrix.modules[8][i] = false; matrix.reserved[8][i] = true; }
    if (!matrix.reserved[i][8]) { matrix.modules[i][8] = false; matrix.reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    matrix.modules[8][size - 1 - i] = false;
    matrix.reserved[8][size - 1 - i] = true;
    matrix.modules[size - 1 - i][8] = false;
    matrix.reserved[size - 1 - i][8] = true;
  }

  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      matrix.modules[row][col] = bit;
      matrix.reserved[row][col] = true;
      matrix.modules[col][row] = bit;
      matrix.reserved[col][row] = true;
    }
  }
}

function placeData(matrix, codewords) {
  const size = matrix.size;
  const bits = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }

  let index = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (matrix.reserved[row][col]) continue;
        matrix.modules[row][col] = index < bits.length ? bits[index] === 1 : false;
        index += 1;
      }
    }
    upward = !upward;
  }
}

function applyMask(matrix, maskId) {
  const mask = MASKS[maskId];
  const out = matrix.modules.map((row) => row.slice());
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.reserved[row][col]) continue;
      if (mask(row, col)) out[row][col] = !out[row][col];
    }
  }
  return out;
}

/**
 * Both copies of the 15-bit format information.
 *
 * The bit order is the part worth stating: bit 0 is the LSB and sits at (0,8)
 * and (8, size-1); bit 14 is the MSB and sits at (8,0) and (size-1, 8). Two
 * copies exist so a code with one damaged corner still reads, which only helps
 * if they are genuinely the same string written in the same direction.
 */
function writeFormat(modules, size, maskId) {
  const bits = formatBits(maskId);
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;

    // Copy 1, running down column 8 then along row 8 — skipping the timing
    // modules at (6,8) and (8,6).
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - 1 - i] = bit;
    else if (i === 8) modules[8][7] = bit;
    else modules[8][14 - i] = bit;
  }
  modules[size - 8][8] = true; // dark module, restated after masking
}

function penalty(modules, size) {
  let score = 0;

  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run += 1;
      } else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  for (let i = 0; i < size; i++) {
    score += runScore(modules[i]);
    score += runScore(modules.map((row) => row[i]));
  }

  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const v = modules[row][col];
      if (v === modules[row][col + 1] && v === modules[row + 1][col] && v === modules[row + 1][col + 1]) {
        score += 3;
      }
    }
  }

  const FINDER = [true, false, true, true, true, false, true, false, false, false, false];
  const matches = (line, start) => FINDER.every((want, offset) => line[start + offset] === want);
  const reversed = [...FINDER].reverse();
  const matchesReversed = (line, start) => reversed.every((want, offset) => line[start + offset] === want);
  for (let i = 0; i < size; i++) {
    const row = modules[i];
    const col = modules.map((r) => r[i]);
    for (let j = 0; j + 11 <= size; j++) {
      if (matches(row, j) || matchesReversed(row, j)) score += 40;
      if (matches(col, j) || matchesReversed(col, j)) score += 40;
    }
  }

  const dark = modules.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encode a string as a QR matrix.
 *
 * @param {string} text
 * @returns {{size: number, version: number, modules: boolean[][]}}
 */
export function encodeQr(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text ?? '')));
  if (bytes.length === 0) throw new Error('QR payload is empty');
  const version = chooseVersion(bytes.length);
  const size = version * 4 + 17;
  const codewords = buildCodewords(bytes, version);

  const matrix = blankMatrix(size);
  placeStatic(matrix, version);
  placeData(matrix, codewords);

  // The standard picks the mask with the lowest penalty; a poor choice is
  // still readable, but a good one survives a bad camera and a folded poster.
  let best = null;
  for (let maskId = 0; maskId < 8; maskId++) {
    const modules = applyMask(matrix, maskId);
    writeFormat(modules, size, maskId);
    const score = penalty(modules, size);
    if (!best || score < best.score) best = { score, modules };
  }

  return { size, version, modules: best.modules };
}

/**
 * Render a QR matrix as a standalone SVG string.
 *
 * The quiet zone is 4 modules, as the specification requires — cropping it is
 * the single most common way a QR code stops scanning, so it is not
 * configurable here. Colours default to true black on true white: a QR code
 * tinted to match a brand is a QR code that fails in dim light.
 */
export function qrSvg(text, { moduleSize = 8, dark = '#000000', light = '#ffffff', label = 'QR code' } = {}) {
  const { modules, size } = encodeQr(text);
  const quiet = 4;
  const dimension = (size + quiet * 2) * moduleSize;

  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules[row][col]) continue;
      const x = (col + quiet) * moduleSize;
      const y = (row + quiet) * moduleSize;
      path += `M${x} ${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}"`,
    ` viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="${String(label).replace(/[<>&"]/g, '')}" shape-rendering="crispEdges">`,
    `<rect width="${dimension}" height="${dimension}" fill="${light}"/>`,
    `<path d="${path}" fill="${dark}"/>`,
    '</svg>',
  ].join('');
}
