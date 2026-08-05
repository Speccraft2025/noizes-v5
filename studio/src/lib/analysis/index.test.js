import { describe, it, expect } from 'vitest';
import { analyseTrack, STAGES, sha256Hex } from './index.js';
import { encodePng, readPngSize } from './encodePng.js';
import { SAMPLE_RATE } from './terrain.js';

function pcm(seconds = 3) {
  const length = Math.round(seconds * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = (t > 0.5 ? 1 : 0) * (0.6 * Math.sin(2 * Math.PI * 220 * t) + 0.2 * Math.sin(2 * Math.PI * 660 * t));
  }
  return samples;
}

/** Stands in for OfflineAudioContext, which does not exist in the node test env. */
const fakeDecode = (samples = pcm()) => async () => ({
  samples,
  sampleRate: SAMPLE_RATE,
  durationSeconds: samples.length / SAMPLE_RATE,
  channels: 1,
  soundField: { channel_correlation: 1, statement: 'mono fixture', measured_on: 'fixture' },
});

const audioBlob = () => new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'audio/mpeg' });

describe('analyseTrack', () => {
  it('returns a terrain blob, an analysis payload and the meta the packager needs', async () => {
    const result = await analyseTrack(audioBlob(), { decode: fakeDecode(), useWorker: false });

    expect(result.terrain).toBeInstanceOf(Blob);
    expect(result.terrain.type).toBe('image/png');
    expect(result.terrain.size).toBeGreaterThan(0);

    expect(result.meta.frames).toBe(result.analysis.frames);
    expect(result.meta.bands).toBe(128);
    expect(result.meta.frameRate).toBeCloseTo(SAMPLE_RATE / 512, 4);
    expect(result.meta.durationSeconds).toBeCloseTo(3, 1);
    expect(result.meta.sourceBytes).toBe(5);
    expect(result.meta.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes the encoded source, not the decoded PCM', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const expected = await sha256Hex(bytes.buffer.slice(0));
    const result = await analyseTrack(audioBlob(), { decode: fakeDecode(), useWorker: false });
    expect(result.meta.sourceSha256).toBe(expected);
    expect(result.analysis.source.sha256).toBe(expected);
  });

  it('emits a real PNG whose dimensions are frames x bands', async () => {
    const result = await analyseTrack(audioBlob(), { decode: fakeDecode(), useWorker: false });
    const size = readPngSize(new Uint8Array(await result.terrain.arrayBuffer()));
    expect(size).toEqual({ width: result.analysis.frames, height: 128 });
  });

  it('reports stages in contract order with progress that never goes backwards', async () => {
    const updates = [];
    await analyseTrack(audioBlob(), {
      decode: fakeDecode(),
      useWorker: false,
      onProgress: update => updates.push(update),
    });

    expect(updates.length).toBeGreaterThan(3);
    for (const update of updates) {
      expect(STAGES).toContain(update.stage);
      expect(update.label).toBeTypeOf('string');
      expect(update.progress).toBeGreaterThanOrEqual(0);
      expect(update.progress).toBeLessThanOrEqual(1);
    }
    // Stage order must follow STAGES, and the overall percentage must be monotonic.
    const seen = updates.map(u => STAGES.indexOf(u.stage));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    const percents = updates.map(u => u.percent);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(updates.at(-1).stage).toBe('encode');
    expect(updates.at(-1).percent).toBe(100);
  });

  it('carries release metadata into the payload without letting it overwrite the hash', async () => {
    const result = await analyseTrack(audioBlob(), {
      decode: fakeDecode(),
      useWorker: false,
      source: { path: 'tracks/01-abc/audio/primary.mp3', title: 'A Title', performer: 'A Performer', sha256: 'not-this' },
    });
    expect(result.analysis.source.title).toBe('A Title');
    expect(result.analysis.source.performer).toBe('A Performer');
    expect(result.analysis.source.path).toBe('tracks/01-abc/audio/primary.mp3');
    expect(result.analysis.source.sha256).not.toBe('not-this');
  });

  it('records the measured sound field the decoder reported', async () => {
    const result = await analyseTrack(audioBlob(), { decode: fakeDecode(), useWorker: false });
    expect(result.analysis.sound_field.channel_correlation).toBe(1);
    expect(result.analysis.sound_field.statement).toBe('mono fixture');
  });

  it('aborts when the signal fires before the run starts', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(analyseTrack(audioBlob(), {
      decode: fakeDecode(), useWorker: false, signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('aborts mid-run and does not resolve', async () => {
    const controller = new AbortController();
    let aborted = false;
    const promise = analyseTrack(audioBlob(), {
      decode: fakeDecode(pcm(8)),
      useWorker: false,
      signal: controller.signal,
      onProgress: (update) => {
        if (!aborted && update.stage === 'spectrum') { aborted = true; controller.abort(); }
      },
    });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(aborted).toBe(true);
  });
});

describe('encodePng', () => {
  it('writes a decodable PNG with the requested dimensions', async () => {
    const width = 9, height = 4;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 7) & 0xff;
    const png = await encodePng(width, height, rgba);
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(readPngSize(png)).toEqual({ width, height });
  });

  it('is deterministic for identical pixels', async () => {
    const rgba = new Uint8Array(64 * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 13) & 0xff;
    const a = await encodePng(8, 8, rgba);
    const b = await encodePng(8, 8, rgba);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('round-trips pixel data through a real decoder, alpha included', async () => {
    // The terrain puts ridge salience in A, so an encoder that premultiplied or
    // quantised alpha would silently corrupt the landscape. Decode with sharp-free
    // zlib inflate and check the raw scanlines back.
    const { inflateSync } = await import('node:zlib');
    const width = 4, height = 3;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = 200;            // elevation stays high
      rgba[i * 4 + 1] = 128;
      rgba[i * 4 + 2] = 64;
      rgba[i * 4 + 3] = i === 0 ? 0 : 255;   // one fully transparent texel
    }
    const png = await encodePng(width, height, rgba);

    // Walk chunks to find IDAT.
    let offset = 8;
    let idat = null;
    while (offset < png.length) {
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
      const length = view.getUint32(offset);
      const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
      if (type === 'IDAT') { idat = png.subarray(offset + 8, offset + 8 + length); break; }
      offset += 12 + length;
    }
    expect(idat).not.toBeNull();

    const raw = new Uint8Array(inflateSync(idat));
    const stride = width * 4;
    // Undo the per-scanline filters to recover the original pixels.
    const out = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? out[y * stride + x - 4] : 0;
        const b = y ? out[(y - 1) * stride + x] : 0;
        const c = y && x >= 4 ? out[(y - 1) * stride + x - 4] : 0;
        let value = line[x];
        if (filter === 1) value += a;
        else if (filter === 2) value += b;
        else if (filter === 3) value += (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        out[y * stride + x] = value & 0xff;
      }
    }
    expect(Array.from(out)).toEqual(Array.from(rgba));
  });
});
