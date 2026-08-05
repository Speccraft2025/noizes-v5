// PNG encoder for the Sonic Terrain, ported to the browser from
// examples/immersive-reference-album/scripts/lib/png.mjs.
//
// This is the primary encoder, not a fallback, and the reason is the alpha
// channel. The terrain packs four independent measurements into RGBA — elevation,
// harmonic mask, transient, ridge salience — so A is data, not opacity. Routing
// those pixels through a canvas (OffscreenCanvas.convertToBlob) means trusting
// every browser to round-trip non-premultiplied alpha exactly, and in practice
// canvas implementations quantise RGB where A is low. Quiet passages have low
// ridge salience and still need their elevation intact, so a lossy alpha
// round-trip would silently flatten the landscape exactly where the record is
// most delicate.
//
// Encoding the bytes ourselves is also deterministic, which the analysis contract
// depends on: the same PCM must always produce the same terrain component hash.

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes, from = 0, to = bytes.length) {
  let c = -1;
  for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** One PNG chunk: length, 4-byte ASCII type, payload, CRC over type+payload. */
function chunk(type, data) {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/**
 * zlib stream (RFC 1950) of `bytes`. CompressionStream('deflate') emits the zlib
 * container PNG's IDAT wants, unlike 'deflate-raw'. Piping through a Blob rather
 * than driving the writer by hand avoids the backpressure deadlock that a
 * write-then-read loop hits on multi-megabyte inputs.
 */
async function zlibCompress(bytes) {
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return zlibStored(bytes);
}

/**
 * Valid zlib stream using only stored (uncompressed) deflate blocks. Bigger, but
 * it means no environment without CompressionStream can block an export.
 */
function zlibStored(bytes) {
  const MAX = 65535;
  const blocks = Math.max(1, Math.ceil(bytes.length / MAX));
  const out = new Uint8Array(2 + blocks * 5 + bytes.length + 4);
  let p = 0;
  out[p++] = 0x78; out[p++] = 0x01;            // deflate, 32K window, no dictionary
  for (let i = 0; i < blocks; i++) {
    const from = i * MAX;
    const len = Math.min(MAX, bytes.length - from);
    out[p++] = i === blocks - 1 ? 1 : 0;       // BFINAL, BTYPE=00 (stored)
    out[p++] = len & 0xff; out[p++] = (len >> 8) & 0xff;
    out[p++] = ~len & 0xff; out[p++] = (~len >> 8) & 0xff;
    out.set(bytes.subarray(from, from + len), p);
    p += len;
  }
  new DataView(out.buffer).setUint32(p, adler32(bytes));
  return out;
}

/**
 * Encode RGBA8 pixel data as a PNG.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba  width * height * 4 bytes
 * @returns {Promise<Uint8Array>}
 */
export async function encodePng(width, height, rgba) {
  const stride = width * 4;
  // Per-scanline filter selection: try each of the five filters and keep the one
  // with the smallest sum of absolute differences, which is what makes the
  // terrain's long harmonic ridges compress well.
  const raw = new Uint8Array((stride + 1) * height);
  const candidates = [
    new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride),
    new Uint8Array(stride), new Uint8Array(stride),
  ];
  for (let y = 0; y < height; y++) {
    const line = rgba.subarray(y * stride, y * stride + stride);
    const prior = y ? rgba.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = candidates[f];
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? line[x - 4] : 0;
        const b = prior ? prior[x] : 0;
        const c = prior && x >= 4 ? prior[x - 4] : 0;
        let v;
        if (f === 0) v = line[x];
        else if (f === 1) v = line[x] - a;
        else if (f === 2) v = line[x] - b;
        else if (f === 3) v = line[x] - ((a + b) >> 1);
        else {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = line[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        out[x] = v & 0xff;
        score += out[x] < 128 ? out[x] : 256 - out[x];
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    raw[y * (stride + 1)] = best;
    raw.set(candidates[best], y * (stride + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type: RGBA

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await zlibCompress(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { png.set(part, offset); offset += part.length; }
  return png;
}

/**
 * Read width and height out of a PNG's IHDR. Used by the export validator to
 * prove the shipped terrain really is `frames x bands` without decoding it.
 * @returns {{ width: number, height: number } | null}
 */
export function readPngSize(bytes) {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== signature[i]) return null;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
