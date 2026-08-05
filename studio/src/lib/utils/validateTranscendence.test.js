import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { describeFailures, extractRuntimeScripts, templateLiterals, validateTranscendence } from './validateTranscendence.js';
import { encodePng } from '../analysis/encodePng.js';

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const encoder = new TextEncoder();

const DOCUMENT = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:;script-src 'self' 'unsafe-inline' blob:;connect-src 'none';object-src 'none'">
<title>A Record — Sonic Terrain</title></head><body>
<audio id="audio"><source src="tracks/01-t1/audio/primary.mp3" type="audio/mpeg"></audio>
<script type="application/json" id="analysis-payload">{"ok":true}</script>
<script>const shader = \`void main(){ gl_Position = vec4(0.0); }\`; const world = 1;</script>
</body></html>`;

/**
 * Build a minimal but *correct* Transcendence package, then let each test break
 * exactly one thing. Every check has to fail on its own and pass in company.
 */
async function buildFixture(mutate = () => {}) {
  const frames = 12;
  const bands = 128;
  const rgba = new Uint8Array(frames * bands * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 31) & 0xff;
  const terrain = await encodePng(frames, bands, rgba);

  const analysis = {
    schema_version: '3.0.0',
    duration_seconds: 40,
    frames,
    parameters: { terrain: { bands } },
    lyrics: [
      { text: 'One', aligned_seconds: 4, terrain_band: 50 },
      { text: 'Two', aligned_seconds: 18, terrain_band: 55 },
    ],
  };

  const files = {
    'experience.html': encoder.encode(DOCUMENT),
    'analysis/t1.terrain.png': terrain,
    'analysis/t1.analysis.json': encoder.encode(JSON.stringify(analysis, null, 1)),
    'tracks/01-t1/audio/primary.mp3': Uint8Array.from([1, 2, 3, 4]),
  };

  const state = { files, analysis, experience: {
    entry: 'experience.html', schema: '4.0.0', template: 'transcendence-v1', type: 'sonic-terrain',
    analysis: 'analysis/t1.analysis.json', terrain: 'analysis/t1.terrain.png',
  } };
  await mutate(state);

  const components = [];
  for (const [path, bytes] of Object.entries(state.files)) {
    components.push({
      component_id: path,
      path,
      type: path.endsWith('.png') ? 'image' : path.endsWith('.json') ? 'analysis' : 'audio',
      role: path.endsWith('.png') ? 'sonic_terrain' : 'component',
      mime: path.endsWith('.json') ? 'application/json' : path.endsWith('.png') ? 'image/png' : 'audio/mpeg',
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes),
    });
  }
  if (state.breakComponent) state.breakComponent(components);

  const manifest = { noizes_version: '1.0.0', components, experience: state.experience };
  const inventory = components.map((c) => `${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
  const authenticity = {
    method: 'sha256-component-inventory',
    hash: state.inventoryHash ?? await sha256Hex(encoder.encode(inventory)),
    components,
  };

  const zip = new JSZip();
  for (const [path, bytes] of Object.entries(state.files)) zip.file(path, bytes);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('authenticity.json', JSON.stringify(authenticity, null, 2));
  return zip;
}

const failed = (report, id) => report.failures.some((failure) => failure.id === id);
const ran = (report, id) => report.checks.some((entry) => entry.id === id);

describe('validateTranscendence — a correct package', () => {
  it('passes every check', async () => {
    const report = await validateTranscendence(await buildFixture());
    expect(report.failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('runs all ten checks', async () => {
    const report = await validateTranscendence(await buildFixture());
    for (const id of [
      'components-intact', 'authenticity-inventory', 'no-remote-references',
      'csp-connect-src-none', 'no-unresolved-markers', 'runtime-parses',
      'no-backtick-in-glsl', 'terrain-dimensions', 'lyrics-ordered-and-in-range',
      'no-secrets-or-machine-paths',
    ]) {
      expect(ran(report, id), `${id} did not run`).toBe(true);
    }
    expect(report.checks).toHaveLength(10);
  });
});

describe('validateTranscendence — component integrity', () => {
  it('fails when a declared component is missing from the archive', async () => {
    const zip = await buildFixture();
    zip.remove('analysis/t1.terrain.png');
    const report = await validateTranscendence(zip);
    expect(failed(report, 'components-intact')).toBe(true);
  });

  it('fails when a component\'s bytes do not match its declared hash', async () => {
    const zip = await buildFixture();
    zip.file('tracks/01-t1/audio/primary.mp3', Uint8Array.from([9, 9, 9, 9]));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'components-intact')).toBe(true);
    expect(report.failures.find((f) => f.id === 'components-intact').detail).toMatch(/sha256/);
  });

  it('fails when a component\'s declared size is wrong', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      state.breakComponent = (components) => { components[0].size += 1; };
    }));
    expect(failed(report, 'components-intact')).toBe(true);
  });

  it('fails when the authenticity inventory does not cover what shipped', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      state.inventoryHash = '0'.repeat(64);
    }));
    expect(failed(report, 'authenticity-inventory')).toBe(true);
  });
});

describe('validateTranscendence — the document is offline', () => {
  it('fails on any http or https reference', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('</body>', '<img src="https://cdn.example.com/x.png"></body>')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(true);
  });

  it('allows a URL in a comment or licence notice, which fetches nothing', async () => {
    // Regression: the first version of this check flagged any "https://" in the
    // file. Three.js and GSAP are inlined into every package and both carry URLs
    // in comments and licence text, so that version rejected every real export
    // while catching nothing — the packaging tests missed it because their
    // template stub had no vendored runtime in it.
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(
      'const world = 1;',
      '/* see https://jcgt.org/published/0007/04/01/ */\n'
      + 'const licence = "Subject to the terms at https://gsap.com/standard-license.";\n'
      + 'const world = 1;',
    )));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(false);
    // And the runtime still parses with those comments in it.
    expect(failed(report, 'runtime-parses')).toBe(false);
  });

  it('still fails a script that actually fetches at runtime', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(
      'const world = 1;', 'fetch("https://telemetry.example.com/beacon");',
    )));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(true);
  });

  it('still fails a remote module import', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(
      'const world = 1;', 'import("https://cdn.example.com/three.js");',
    )));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(true);
  });

  it('still fails a remote stylesheet in CSS', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(
      '</head>', '<style>body{background:url(https://cdn.example.com/bg.png)}</style></head>',
    )));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(true);
  });

  it('allows the SVG namespace, which is an identifier and never fetched', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('</body>', '<svg xmlns="http://www.w3.org/2000/svg"></svg></body>')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-remote-references')).toBe(false);
  });

  it('fails when the CSP does not forbid connections', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(";connect-src 'none'", '')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'csp-connect-src-none')).toBe(true);
  });

  it('fails when the document declares no CSP at all', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(/<meta http-equiv[^>]+>/, '')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'csp-connect-src-none')).toBe(true);
  });
});

describe('validateTranscendence — the build completed', () => {
  it('fails when a marker survived into the shipped document', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('A Record', '/* TX_TITLE */')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-unresolved-markers')).toBe(true);
    expect(report.failures.find((f) => f.id === 'no-unresolved-markers').detail).toContain('TX_TITLE');
  });

  it('fails when an audio-source marker survived', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(/<source[^>]+>/, '<!-- TX_AUDIO_SOURCES -->')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-unresolved-markers')).toBe(true);
  });
});

describe('validateTranscendence — the runtime survives assembly', () => {
  it('fails when the assembled runtime does not parse', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('const world = 1;', 'const world = ;')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'runtime-parses')).toBe(true);
  });

  it('catches the stray backtick that silently ends a GLSL literal', async () => {
    // The landmine: a backtick inside a shader terminates the template literal
    // early, and the rest of the runtime becomes garbage. It must fail the build.
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(
      DOCUMENT.replace('gl_Position = vec4(0.0);', 'gl_Position = vec4(0.0); // ` oops'),
    ));
    const report = await validateTranscendence(zip);
    expect(report.ok).toBe(false);
    expect(failed(report, 'runtime-parses') || failed(report, 'no-backtick-in-glsl')).toBe(true);
  });

  it('fails when a shader literal contains an escaped backtick', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(
      DOCUMENT.replace('gl_Position = vec4(0.0);', 'gl_Position = vec4(0.0); // \\` escaped'),
    ));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-backtick-in-glsl')).toBe(true);
  });

  it('fails when the document has no runtime script at all', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace(/<script>[\s\S]*?<\/script>/, '')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'runtime-parses')).toBe(true);
  });

  it('does not mistake a JSON payload block for runtime code', async () => {
    const scripts = extractRuntimeScripts(DOCUMENT);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('gl_Position');
    expect(scripts[0]).not.toContain('"ok":true');
  });
});

describe('validateTranscendence — the terrain is the landscape', () => {
  it('fails when the terrain dimensions disagree with the analysis', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.frames = 999;
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'terrain-dimensions')).toBe(true);
    expect(report.failures.find((f) => f.id === 'terrain-dimensions').detail).toMatch(/999/);
  });

  it('fails when the descriptor names no terrain', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      delete state.experience.terrain;
    }));
    expect(failed(report, 'terrain-dimensions')).toBe(true);
  });
});

describe('validateTranscendence — the lyric', () => {
  it('fails when a line is placed outside the track', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.lyrics[1].aligned_seconds = 500;
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'lyrics-ordered-and-in-range')).toBe(true);
  });

  it('fails when lines are out of the order they are sung', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.lyrics[1].aligned_seconds = 1;
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'lyrics-ordered-and-in-range')).toBe(true);
    expect(report.failures.find((f) => f.id === 'lyrics-ordered-and-in-range').detail).toMatch(/before line 1/);
  });

  it('passes an instrumental package with no lyric at all', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.lyrics = [];
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'lyrics-ordered-and-in-range')).toBe(false);
  });
});

describe('validateTranscendence — nothing leaked from the creator\'s machine', () => {
  it('fails on a credential-shaped string', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('A Record', 'AKIAIOSFODNN7EXAMPLE')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-secrets-or-machine-paths')).toBe(true);
  });

  it('fails on an absolute path from the build machine', async () => {
    const zip = await buildFixture();
    zip.file('experience.html', encoder.encode(DOCUMENT.replace('A Record', '/Users/someone/Documents/master.wav')));
    const report = await validateTranscendence(zip);
    expect(failed(report, 'no-secrets-or-machine-paths')).toBe(true);
    expect(report.failures.find((f) => f.id === 'no-secrets-or-machine-paths').detail).toMatch(/machine path/);
  });

  it('fails on a private key block inside a JSON component', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.note = '-----BEGIN RSA PRIVATE KEY-----';
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'no-secrets-or-machine-paths')).toBe(true);
  });

  it('does not flag ordinary relative project paths', async () => {
    const report = await validateTranscendence(await buildFixture(async (state) => {
      const analysis = JSON.parse(new TextDecoder().decode(state.files['analysis/t1.analysis.json']));
      analysis.generated_by = 'studio/src/lib/analysis/terrain.js';
      state.files['analysis/t1.analysis.json'] = encoder.encode(JSON.stringify(analysis, null, 1));
    }));
    expect(failed(report, 'no-secrets-or-machine-paths')).toBe(false);
  });
});

describe('validateTranscendence — a package with no manifest', () => {
  it('reports that rather than throwing', async () => {
    const zip = new JSZip();
    zip.file('experience.html', DOCUMENT);
    const report = await validateTranscendence(zip);
    expect(report.ok).toBe(false);
    expect(failed(report, 'manifest-present')).toBe(true);
  });
});

describe('templateLiterals', () => {
  it('finds a template literal and its content', () => {
    const found = templateLiterals('const a = `hello`; const b = 2;');
    expect(found.map((literal) => literal.content)).toEqual(['hello']);
  });

  it('handles interpolation without ending the literal early', () => {
    const found = templateLiterals('const a = `x ${ y } z`;');
    expect(found[0].content).toBe('x ${ y } z');
  });

  it('ignores a backtick inside a quoted string', () => {
    expect(templateLiterals(`const a = "not \` a literal";`)).toEqual([]);
  });

  it('ignores a backtick inside a comment', () => {
    expect(templateLiterals('// a ` in prose\nconst a = 1;')).toEqual([]);
    expect(templateLiterals('/* a ` in prose */ const a = 1;')).toEqual([]);
  });
});

describe('describeFailures', () => {
  it('reads as sentences a creator could act on', () => {
    const text = describeFailures([
      { id: 'terrain-dimensions', detail: 'terrain is 10x128, analysis declares 12x128' },
      { id: 'runtime-parses', detail: '' },
    ]);
    expect(text).toContain('terrain-dimensions: terrain is 10x128');
    expect(text).toContain('runtime-parses');
  });
});
