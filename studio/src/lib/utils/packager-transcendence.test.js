import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import JSZip from 'jszip';
import { buildPackage } from './packager.js';
import { __setTranscendenceSources } from './transcendence.js';
import { __setTranscendenceV2Sources } from './transcendence-v2.js';
import { createAudioAsset, createAudioVersion, createReleaseProject } from '../domain/release.js';
import { analyseSamples, SAMPLE_RATE } from '../analysis/terrain.js';
import { encodePng } from '../analysis/encodePng.js';

const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
});

afterAll(() => {
  delete globalThis.document;
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
});

/**
 * A stand-in for the prebuilt template. The real TRANSCENDENCE.html is 807 KB of
 * inlined Three.js; loading it into every test would dominate the run, and what
 * these tests are checking is the packaging contract, not the renderer. It carries
 * the same markers and the same Three.js sentinel that assertTemplatePrebuilt
 * looks for, so the assembly path is exercised exactly as in production.
 */
const fakeTemplate = `<!doctype html><html lang="en"><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:;connect-src 'none'">
<title>/* TX_TITLE */ — Sonic Terrain</title>
<style>/* TRANSCENDENCE_CSS */</style>
</head><body>
<p class="threshold-title">/* TX_THRESHOLD_TITLE */</p>
<span>/* TX_THRESHOLD_ACTION */</span>
<p>/* TX_THRESHOLD_HINT */</p>
<p class="identity-track">/* TX_TITLE */</p>
<p class="identity-sub">/* TX_SUBTITLE */</p>
<p class="credit">/* TX_CREDIT */</p>
<span id="elapsed">0:00 / /* TX_DURATION_LABEL */</span>
<input id="sheet-seek" type="range" min="0" max="/* TX_ARC_END */">
<h3 id="scene-title">/* TX_OPENING_TITLE */</h3>
<p id="scene-description">/* TX_OPENING_SCENE */</p>
<p class="note">/* TX_LYRIC_PROVENANCE */</p>
<audio id="audio" preload="auto" crossorigin="anonymous">
    <!-- TX_AUDIO_SOURCES -->
</audio>
<!-- DEBUG_PANEL -->
<script type="application/json" id="analysis-payload">/* ANALYSIS_PAYLOAD */</script>
<script type="application/json" id="edition-payload">/* EDITION_PAYLOAD */</script>
<script type="application/json" id="config-payload">/* CONFIG_PAYLOAD */</script>
<script type="application/json" id="sequence-payload">/* SEQUENCE_PAYLOAD */</script>
<script>window.THREE=Object.assign({},{});</script>
<script>/* TRANSCENDENCE_RUNTIME */</script>
</body></html>`;

beforeAll(() => {
  __setTranscendenceSources({
    template: fakeTemplate,
    styles: '#stage{background:#000}',
    runtime: 'const TX_RUNTIME_LOADED = true;',
  });
  __setTranscendenceV2Sources({
    template: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'"><title>/* TXV2_TITLE */</title><style>/* TXV2_CSS */</style></head><body><main id="app"></main><script>/* THREE_RUNTIME */</script><script>window.__TXV2_CONFIG=/* TXV2_CONFIG */;</script><script>/* TXV2_RUNTIME */</script></body></html>`,
    styles: 'body{background:#102318}',
    three: 'window.THREE={};',
    runtime: 'window.__TXV2_READY__=true;',
  });
});

/** A short synthetic recording with a couple of phrases and some transients. */
function pcm(seconds = 8) {
  const length = Math.round(seconds * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = t < 1 ? 0 : t < 3 ? 1 : t < 3.8 ? 0 : t < 6.5 ? 1 : 0;
    samples[i] = envelope * (0.6 * Math.sin(2 * Math.PI * 196 * t) + 0.3 * Math.sin(2 * Math.PI * 392 * t));
    if (i % Math.round(SAMPLE_RATE / 2) === 0) samples[i] += 0.9;
  }
  return samples;
}

const audioFile = (name, bytes) => ({
  name,
  type: 'audio/mpeg',
  size: bytes.length,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});

async function transcendenceProject({ timedLines = [], landmarks = [], artDirection = {} } = {}) {
  const project = createReleaseProject({
    release: { release_type: 'single', title: 'The Standing Wave', primary_artist: 'Anon', genre: ['Ambient'] },
    tracks: [{ title: 'One', primary_artist: 'Anon', disc_number: 1, track_number: 1 }],
    edition: { edition_name: 'First Edition', edition_size: '25', price: '1500', currency: 'KES' },
  });
  const track = project.tracks[0];
  const version = createAudioVersion({ track_id: track.track_id, role: 'primary_master', is_primary: true });
  const asset = createAudioAsset({
    track_id: track.track_id,
    version_id: version.version_id,
    role: 'primary_master',
    scope: 'track',
    file: audioFile('one.mp3', [1, 2, 3, 4, 5, 6]),
  }, { releaseId: project.release.release_id });
  version.audio_asset_id = asset.asset_id;
  track.primary_version_id = version.version_id;
  track.primary_audio_ref = asset.asset_id;
  project.audio_versions.push(version);
  project.audio_assets.push(asset);

  if (timedLines.length) {
    project.lyrics = [{
      track_id: track.track_id, language: 'en', instrumental: false,
      plain_text: timedLines.map((line) => line.text).join('\n'),
      timed_lines: timedLines, translations: [],
    }];
  }

  const { terrainRGBA, width, height, analysis } = analyseSamples(pcm());
  const png = await encodePng(width, height, terrainRGBA);

  return {
    project,
    track,
    input: {
      project,
      template: 'transcendence-v1',
      download: false,
      transcendence: {
        track_id: track.track_id,
        terrain: new Blob([png], { type: 'image/png' }),
        analysis,
        terrain_data: { rgba: terrainRGBA, width, height },
        landmarks,
        art_direction: artDirection,
      },
    },
    analysis,
    terrainSize: { width, height },
  };
}

const unzip = async (result) => JSZip.loadAsync(await result.blob.arrayBuffer());

describe('buildPackage — Transcendence', () => {
  it('bakes V2 world, hierarchy, journey, and NED tracks for an arbitrary creator track', async () => {
    const { input, track } = await transcendenceProject();
    input.template = 'transcendence-v2';
    input.transcendence.direction_tracks = { ahead: [{ time: 0, value: 0.9 }, { time: 8, value: 1.1 }] };
    const result = await buildPackage(input);
    const zip = await unzip(result);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    const world = JSON.parse(await zip.file(`analysis/${track.track_id}.world.json`).async('string'));
    const geography = JSON.parse(await zip.file(`analysis/${track.track_id}.landmarks.json`).async('string'));
    const journey = JSON.parse(await zip.file(`timeline/${track.track_id}.journey.json`).async('string'));
    const html = await zip.file('experience.html').async('string');

    expect(result.filename).toBe('the_standing_wave_transcendence-v2_noizes.nz');
    expect(manifest.experience).toMatchObject({ template: 'transcendence-v2', schema: '5.0.0' });
    expect(world.schema).toBe('transcendence-world-v2');
    expect(geography.counts).toMatchObject({ ranges: 4, troughs: 3 });
    expect(journey.samples).toHaveLength(901);
    expect(journey.sequence.at(-1)).toBe('SECOND_TROUGH');
    expect(html).toContain(`tracks/01-${track.track_id}/audio/primary.mp3`);
    expect(html).toContain('"directionTracks":{"ahead"');
    expect(html).not.toContain('Ovacado');
  });

  it('ships audio, terrain and analysis as separate hashed components', async () => {
    const { input, track, terrainSize } = await transcendenceProject();
    const result = await buildPackage(input);
    const zip = await unzip(result);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));

    const terrainPath = `analysis/${track.track_id}.terrain.png`;
    const analysisPath = `analysis/${track.track_id}.analysis.json`;
    const worldPath = `analysis/${track.track_id}.world.json`;
    const landmarksPath = `analysis/${track.track_id}.landmarks.json`;
    const journeyPath = `timeline/${track.track_id}.journey.json`;
    const audioPath = `tracks/01-${track.track_id}/audio/primary.mp3`;

    for (const path of [terrainPath, analysisPath, worldPath, landmarksPath, journeyPath, audioPath]) {
      expect(zip.file(path), `${path} missing from the zip`).toBeTruthy();
      const component = manifest.components.find((entry) => entry.path === path);
      expect(component, `${path} not declared in manifest.components`).toBeTruthy();
      expect(component.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(component.size).toBeGreaterThan(0);
    }

    // Every declared size and hash must match the bytes actually in the archive.
    for (const component of manifest.components) {
      const bytes = await zip.file(component.path).async('uint8array');
      expect(bytes.byteLength, `${component.path} size`).toBe(component.size);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      expect(hex, `${component.path} sha256`).toBe(component.sha256);
    }

    const terrain = manifest.components.find((entry) => entry.path === terrainPath);
    expect(terrain.role).toBe('sonic_terrain');
    expect(terrain.type).toBe('image');
    expect(terrain.track_id).toBe(track.track_id);
    expect(terrainSize.height).toBe(128);
  });

  it('puts no base64 audio and no base64 terrain in the document', async () => {
    const { input, track } = await transcendenceProject();
    const result = await buildPackage(input);
    const zip = await unzip(result);
    const html = await zip.file('experience.html').async('string');

    expect(html).not.toContain('data:audio');
    expect(html).not.toContain('data:image/png;base64');
    // The audio is referenced by the path it actually occupies in the package.
    expect(html).toContain(`tracks/01-${track.track_id}/audio/primary.mp3`);
    expect(html).toContain(`analysis/${track.track_id}.terrain.png`);
  });

  it('leaves no unfilled template marker in the document', async () => {
    const { input } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const html = await zip.file('experience.html').async('string');
    expect(html).not.toMatch(/\/\* TX_[A-Z_]+ \*\//);
    expect(html).not.toMatch(/\/\* [A-Z_]*PAYLOAD \*\//);
    expect(html).not.toContain('/* TRANSCENDENCE_RUNTIME */');
    expect(html).not.toContain('/* TRANSCENDENCE_CSS */');
    expect(html).not.toContain('<!-- TX_AUDIO_SOURCES -->');
  });

  it('carries the release identity into the document instead of the reference record', async () => {
    const { input } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const html = await zip.file('experience.html').async('string');
    expect(html).toContain('The Standing Wave');
    expect(html).not.toContain('Home, Sweet Home');
    expect(html).not.toContain('Macdonough');
  });

  it('describes the experience as a sonic terrain in the manifest and experience.json', async () => {
    const { input, track } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    const experience = JSON.parse(await zip.file('experience.json').async('string'));

    expect(manifest.experience).toMatchObject({
      entry: 'experience.html',
      template: 'transcendence-v1',
      type: 'sonic-terrain',
      schema: '4.0.0',
      default_mode: 'world',
      fallback_mode: 'essential',
      analysis: `analysis/${track.track_id}.analysis.json`,
      terrain: `analysis/${track.track_id}.terrain.png`,
      world: `analysis/${track.track_id}.world.json`,
      landmarks: `analysis/${track.track_id}.landmarks.json`,
      journey: `timeline/${track.track_id}.journey.json`,
    });
    expect(manifest.experience.quality_profiles).toEqual(['cinematic', 'balanced', 'lite', 'essential']);
    expect(manifest.experience.authored_arc.track_id).toBe(track.track_id);
    expect(experience.type).toBe('sonic-terrain');
    expect(experience.lyric_landmarks).toBe('creator-placed');
    expect(experience.art_direction.palette).toBe('alabaster');
  });

  it('ships a timeline whose cues match the sequence the document received', async () => {
    const { input, track } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const timeline = JSON.parse(await zip.file(`timeline/${track.track_id}.timeline.json`).async('string'));
    const html = await zip.file('experience.html').async('string');
    const embedded = JSON.parse(
      html.match(/<script type="application\/json" id="sequence-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );

    expect(timeline.master_clock).toBe('audio.currentTime');
    expect(timeline.cues.length).toBe(embedded.length);
    expect(timeline.cues.map((cue) => cue.time)).toEqual(embedded.map((cue) => cue.time));
    // Strictly increasing: the cue engine reduces from the start every frame.
    for (let i = 1; i < embedded.length; i++) {
      expect(embedded[i].time).toBeGreaterThan(embedded[i - 1].time);
    }
    expect(timeline.authorship.cues_total).toBe(embedded.length);
  });

  it('records the analysis component and the embedded payload identically', async () => {
    const { input, track } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const shipped = JSON.parse(await zip.file(`analysis/${track.track_id}.analysis.json`).async('string'));
    const html = await zip.file('experience.html').async('string');
    const embedded = JSON.parse(
      html.match(/<script type="application\/json" id="analysis-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );
    expect(embedded.frames).toBe(shipped.frames);
    expect(embedded.parameters.terrain.bands).toBe(128);
    expect(JSON.stringify(embedded.curves)).toBe(JSON.stringify(shipped.curves));
  });

  it('joins creator-placed lyric landmarks onto the measured analysis', async () => {
    const timedLines = [
      { t: 1200, text: 'First line' },
      { t: 4200, text: 'Second line' },
    ];
    const { input } = await transcendenceProject({
      timedLines,
      landmarks: [{ line: 0, time: 1.4, band: 60 }, { line: 1, time: 4.5, band: 72 }],
    });
    const zip = await unzip(await buildPackage(input));
    const html = await zip.file('experience.html').async('string');
    const embedded = JSON.parse(
      html.match(/<script type="application\/json" id="analysis-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );

    expect(embedded.lyrics).toHaveLength(2);
    expect(embedded.lyrics[0]).toMatchObject({
      text: 'First line', aligned_seconds: 1.4, declared_seconds: 1.2, terrain_band: 60,
      alignment_method: 'creator-placed',
    });
    expect(embedded.lyrics[0].drift_seconds).toBeCloseTo(0.2, 3);
    expect(embedded.lyrics[0].terrain_band_hz).toBeGreaterThan(0);
    // Source order preserved.
    expect(embedded.lyrics[1].aligned_seconds).toBeGreaterThan(embedded.lyrics[0].aligned_seconds);

    // A cue carries each placed line, so it is actually cut into the terrain.
    const sequence = JSON.parse(
      html.match(/<script type="application\/json" id="sequence-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );
    expect(sequence.filter((cue) => cue.lyric !== undefined).map((cue) => cue.lyric).sort()).toEqual([0, 1]);
  });

  it('passes the creator art direction into the runtime configuration', async () => {
    const { input } = await transcendenceProject({
      artDirection: { palette: 'oxide', heightScale: 1.6, terracing: false, sunElevation: 20 },
    });
    const zip = await unzip(await buildPackage(input));
    const html = await zip.file('experience.html').async('string');
    const config = JSON.parse(
      html.match(/<script type="application\/json" id="config-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );
    expect(config.artDirection).toMatchObject({ palette: 'oxide', heightScale: 1.6, terracing: false, sunElevation: 20 });
    expect(config.slice.start).toBe(0);
    expect(config.slice.end).toBeGreaterThan(0);
    expect(config.worldData?.landmarks?.length ?? 0).toBeGreaterThan(0);
  });

  it('clamps out-of-range art direction rather than shipping it', async () => {
    const { input } = await transcendenceProject({
      artDirection: { palette: 'chartreuse', heightScale: 99, sunElevation: -400 },
    });
    const zip = await unzip(await buildPackage(input));
    const html = await zip.file('experience.html').async('string');
    const config = JSON.parse(
      html.match(/<script type="application\/json" id="config-payload">([\s\S]*?)<\/script>/)[1]
        .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
    );
    expect(config.artDirection.palette).toBe('alabaster');
    expect(config.artDirection.heightScale).toBeLessThanOrEqual(2.2);
    expect(config.artDirection.sunElevation).toBeGreaterThanOrEqual(8);
  });

  it('names the file after the chosen system', async () => {
    const { input } = await transcendenceProject();
    const result = await buildPackage(input);
    expect(result.filename).toBe('the_standing_wave_transcendence-v1_noizes.nz');
  });

  it('covers the terrain and analysis in the authenticity inventory', async () => {
    const { input, track } = await transcendenceProject();
    const zip = await unzip(await buildPackage(input));
    const authenticity = JSON.parse(await zip.file('authenticity.json').async('string'));
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));

    const paths = authenticity.components.map((component) => component.path);
    expect(paths).toContain(`analysis/${track.track_id}.terrain.png`);
    expect(paths).toContain(`analysis/${track.track_id}.analysis.json`);

    // The inventory hash must be reproducible from the manifest's own component list.
    const inventory = manifest.components
      .map((component) => `${component.path}:${component.sha256}:${component.size}`)
      .sort().join('\n');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inventory));
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(authenticity.hash).toBe(hex);
  });

  it('refuses to build without an analysed terrain instead of shipping a broken object', async () => {
    const { input } = await transcendenceProject();
    delete input.transcendence.terrain;
    await expect(buildPackage(input)).rejects.toThrow(/terrain/i);
  });

  it('refuses to build without an analysis payload', async () => {
    const { input } = await transcendenceProject();
    delete input.transcendence.analysis;
    await expect(buildPackage(input)).rejects.toThrow(/analysis/i);
  });

  it('refuses to build without raw terrain samples for world extraction', async () => {
    const { input } = await transcendenceProject();
    delete input.transcendence.terrain_data;
    await expect(buildPackage(input)).rejects.toThrow(/raw terrain samples/i);
  });
});

describe('buildPackage — ULTRA is unaffected', () => {
  it('still produces an ULTRA package with the ULTRA descriptor and filename', async () => {
    const { input } = await transcendenceProject();
    const ultra = { ...input, template: 'ultra-v2' };
    delete ultra.transcendence;
    const result = await buildPackage(ultra);
    const zip = await unzip(result);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));

    expect(result.filename).toBe('the_standing_wave_ultra-v2_noizes.nz');
    expect(manifest.experience).toEqual({ entry: 'experience.html', schema: '3.0.0', template: 'ultra-v2' });
    expect(manifest.components.some((component) => component.role === 'sonic_terrain')).toBe(false);
    expect(zip.file('timeline')).toBeFalsy();
  });

  it('collapses a legacy template value to ULTRA rather than failing', async () => {
    const { input } = await transcendenceProject();
    const legacy = { ...input, template: 'monument' };
    delete legacy.transcendence;
    const result = await buildPackage(legacy);
    const manifest = JSON.parse(await (await unzip(result)).file('manifest.json').async('string'));
    expect(manifest.experience.template).toBe('ultra-v2');
  });
});
