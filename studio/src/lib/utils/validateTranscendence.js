// The export gate for Transcendence packages.
//
// Ported from examples/immersive-reference-album/scripts/validate-transcendence.mjs
// and run against the built archive itself, not against the inputs that produced
// it — the only artifact that matters is the one a collector will open.
//
// A creator must not be able to publish a broken object. Every check here has
// either already shipped broken once in this project's history, or would be
// invisible until a collector opened the package offline and got a black page.

import { findUnfilledMarkers } from '../experiences/transcendence/markers.js';
import { readPngSize } from '../analysis/encodePng.js';

/** Text a human should never find inside a package. */
const CREDENTIAL_PATTERNS = [
  { id: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'supabase-service-key', re: /\bservice_role\b/ },
  { id: 'bearer-header', re: /\bAuthorization:\s*Bearer\s+\S{16,}/i },
];

/** A path that only exists on the machine that built the package. */
const MACHINE_PATH_PATTERNS = [
  { id: 'macos-home', re: /\/Users\/[A-Za-z0-9._-]+\/(?:Documents|Desktop|Downloads|Library|Projects)\b/ },
  { id: 'linux-home', re: /\/home\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/ },
  { id: 'windows-home', re: /[A-Za-z]:\\Users\\[A-Za-z0-9._ -]+\\/ },
];

const textLike = (path, mime = '') =>
  /\.(json|txt|html|css|js|md|lrc|svg)$/i.test(path) || /^(text\/|application\/json)/.test(mime);

const check = (id, ok, detail = '') => ({ id, ok: Boolean(ok), detail });

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract the contents of every plain `<script>` block — the ones that execute.
 * `<script type="application/json">` payload blocks are data and are skipped.
 */
export function extractRuntimeScripts(html) {
  const scripts = [];
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] || '';
    if (/\stype\s*=\s*["']?application\/json/i.test(attributes)) continue;
    if (/\ssrc\s*=/i.test(attributes)) continue;
    scripts.push(match[2]);
  }
  return scripts;
}

/**
 * Every template literal in `source`, as { content, start } — a small scanner
 * rather than a regex, because a regex cannot track escapes or `${}` nesting and
 * would either miss shaders or invent them.
 */
export function templateLiterals(source) {
  const found = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') { i += 2; continue; }
    // Skip over line and block comments so a backtick in prose is not a literal.
    if (char === '/' && source[i + 1] === '/') { i = indexOrEnd(source, '\n', i); continue; }
    if (char === '/' && source[i + 1] === '*') { i = indexOrEnd(source, '*/', i) + 2; continue; }
    if (char === '"' || char === "'") { i = skipQuoted(source, i, char); continue; }
    if (char === '`') {
      const start = i + 1;
      let j = start;
      let depth = 0;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === '$' && source[j + 1] === '{') { depth++; j += 2; continue; }
        if (source[j] === '}' && depth > 0) { depth--; j++; continue; }
        if (source[j] === '`' && depth === 0) break;
        j++;
      }
      found.push({ content: source.slice(start, j), start });
      i = j + 1;
      continue;
    }
    i++;
  }
  return found;
}

const indexOrEnd = (source, token, from) => {
  const at = source.indexOf(token, from);
  return at === -1 ? source.length : at;
};

function skipQuoted(source, i, quote) {
  let j = i + 1;
  while (j < source.length) {
    if (source[j] === '\\') { j += 2; continue; }
    if (source[j] === quote || source[j] === '\n') return j + 1;
    j++;
  }
  return j;
}

const looksLikeGlsl = (content) =>
  /\bvoid\s+main\s*\(/.test(content) || /\bgl_(Position|FragColor)\b/.test(content)
  || /\b(varying|attribute)\s+(vec|float|mat)/.test(content);

/**
 * Validate a built Transcendence package.
 *
 * @param {import('jszip')} zip  the archive as built, before download
 * @returns {Promise<{ ok: boolean, checks: Array, failures: Array }>}
 */
export async function validateTranscendence(zip) {
  const checks = [];
  const read = async (path) => {
    const file = zip.file(path);
    return file ? file.async('uint8array') : null;
  };
  const readText = async (path) => {
    const file = zip.file(path);
    return file ? file.async('string') : null;
  };

  const manifestText = await readText('manifest.json');
  if (!manifestText) {
    return finish([check('manifest-present', false, 'manifest.json is missing from the package.')]);
  }
  const manifest = JSON.parse(manifestText);
  const components = manifest.components || [];

  /* 1 — every declared component exists and matches its size and hash */
  {
    const problems = [];
    for (const component of components) {
      const bytes = await read(component.path);
      if (!bytes) { problems.push(`${component.path} is declared but not in the archive`); continue; }
      if (bytes.byteLength !== component.size) {
        problems.push(`${component.path} is ${bytes.byteLength} bytes, declared ${component.size}`);
        continue;
      }
      const hex = await sha256Hex(bytes);
      if (hex !== component.sha256) problems.push(`${component.path} does not match its declared sha256`);
    }
    checks.push(check('components-intact', !problems.length, problems.join('; ')));
  }

  /* 2 — the authenticity inventory covers exactly what shipped */
  {
    const authenticityText = await readText('authenticity.json');
    if (!authenticityText) {
      checks.push(check('authenticity-inventory', false, 'authenticity.json is missing.'));
    } else {
      const authenticity = JSON.parse(authenticityText);
      const inventory = components
        .map((component) => `${component.path}:${component.sha256}:${component.size}`)
        .sort().join('\n');
      const expected = await sha256Hex(new TextEncoder().encode(inventory));
      checks.push(check('authenticity-inventory', authenticity.hash === expected,
        authenticity.hash === expected ? '' : 'The inventory hash does not cover the shipped components.'));
    }
  }

  const html = await readText('experience.html');
  if (html == null) {
    checks.push(check('experience-present', false, 'experience.html is missing from the package.'));
    return finish(checks);
  }

  /* 3 — nothing in the document reaches for the network
   *
   * The check is for URLs in *fetchable positions*, not for the string "https://"
   * anywhere in the file. Three.js and GSAP are inlined into every package, and
   * both carry URLs in comments and licence notices — a paper citation inside a
   * shader, a link to the GSAP licence. Flagging those would reject every genuine
   * export while catching nothing, so the check looks at the places a URL can
   * actually cause a request. `connect-src 'none'` (check 4) covers the rest. */
  {
    const remote = [];
    const patterns = [
      // Attributes that load something.
      /\b(?:src|href|data-src|poster|srcset|action|formaction)\s*=\s*["']?(https?:\/\/[^\s"'>]+)/gi,
      // CSS.
      /url\(\s*["']?(https?:\/\/[^\s"')]+)/gi,
      /@import\s+["'](https?:\/\/[^"']+)/gi,
      // Code that fetches.
      /\b(?:fetch|importScripts|XMLHttpRequest|EventSource|WebSocket)\s*\(\s*["'`](https?:\/\/[^"'`]+)/gi,
      /\bnew\s+(?:Worker|SharedWorker|WebSocket|EventSource)\s*\(\s*["'`](https?:\/\/[^"'`]+)/gi,
      /\bimport\s*\(\s*["'`](https?:\/\/[^"'`]+)/gi,
      /\bfrom\s+["'](https?:\/\/[^"']+)/gi,
    ];
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        // Namespace URLs in inline SVG are identifiers, never fetched.
        if (match[1].startsWith('http://www.w3.org/')) continue;
        remote.push(match[1]);
      }
    }
    checks.push(check('no-remote-references', !remote.length,
      remote.length ? `${remote.length} remote reference(s), first: ${remote[0]}` : ''));
  }

  /* 4 — and could not reach it even if it tried */
  {
    // The policy value itself is full of single quotes (`'self'`, `'none'`), so the
    // attribute has to be read to its *matching* delimiter rather than to the first
    // quote of any kind.
    const csp = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*content=(["'])([\s\S]*?)\1/i);
    const value = csp?.[2] || '';
    const ok = /connect-src\s+'none'/.test(value);
    checks.push(check('csp-connect-src-none', ok, ok ? ''
      : value ? 'The CSP does not declare connect-src \'none\'.' : 'The document declares no Content-Security-Policy.'));
  }

  /* 5 — no build marker survived into the shipped document */
  {
    const leftover = findUnfilledMarkers(html);
    checks.push(check('no-unresolved-markers', !leftover.length,
      leftover.length ? `unfilled: ${leftover.join(', ')}` : ''));
  }

  const scripts = extractRuntimeScripts(html);

  /* 6 — the assembled runtime actually parses
   *
   * This is the landmine that has already cost this project once: the runtime is
   * concatenated into one inline script, and a single stray backtick inside a GLSL
   * template literal silently breaks the whole page — blank render, no console
   * output, no error. It has to fail the build, not the creator's launch. */
  {
    let failure = '';
    if (!scripts.length) failure = 'The document contains no runtime script at all.';
    for (const [index, source] of scripts.entries()) {
      if (failure) break;
      try {
        // eslint-disable-next-line no-new-func
        new Function(source);
      } catch (error) {
        failure = `script block ${index + 1} does not parse: ${error.message}`;
      }
    }
    checks.push(check('runtime-parses', !failure, failure));
  }

  /* 7 — and no shader carries an escaped backtick, which is how that break starts */
  {
    const offenders = [];
    for (const source of scripts) {
      for (const literal of templateLiterals(source)) {
        if (!looksLikeGlsl(literal.content)) continue;
        if (literal.content.includes('\\`') || literal.content.includes('`')) {
          offenders.push(literal.content.slice(0, 60).replace(/\s+/g, ' '));
        }
      }
    }
    checks.push(check('no-backtick-in-glsl', !offenders.length,
      offenders.length ? `${offenders.length} shader literal(s) contain a backtick, starting with: ${offenders[0]}` : ''));
  }

  /* 8 — the terrain really is frames x bands */
  {
    const descriptor = manifest.experience || {};
    const terrainPath = descriptor.terrain;
    const analysisPath = descriptor.analysis;
    if (!terrainPath || !analysisPath) {
      checks.push(check('terrain-dimensions', false, 'The experience descriptor names no terrain or analysis component.'));
    } else {
      const declared = components.find((component) => component.path === terrainPath);
      const terrainBytes = await read(terrainPath);
      const analysisText = await readText(analysisPath);
      if (!declared) {
        checks.push(check('terrain-dimensions', false, `${terrainPath} is not a declared component.`));
      } else if (!terrainBytes || !analysisText) {
        checks.push(check('terrain-dimensions', false, 'The terrain or analysis file is missing from the archive.'));
      } else {
        const analysis = JSON.parse(analysisText);
        const size = readPngSize(terrainBytes);
        const bands = analysis.parameters?.terrain?.bands ?? 128;
        const ok = size && size.width === analysis.frames && size.height === bands;
        checks.push(check('terrain-dimensions', ok,
          ok ? '' : `terrain is ${size ? `${size.width}x${size.height}` : 'unreadable'}, analysis declares ${analysis.frames}x${bands}`));
      }
    }
  }

  /* 9 — the lyric is in the order it is sung, and lands inside the track */
  {
    const analysisPath = manifest.experience?.analysis;
    const analysisText = analysisPath ? await readText(analysisPath) : null;
    if (!analysisText) {
      checks.push(check('lyrics-ordered-and-in-range', false, 'No analysis payload to check the lyric against.'));
    } else {
      const analysis = JSON.parse(analysisText);
      const lines = analysis.lyrics || [];
      const duration = Number(analysis.duration_seconds) || 0;
      const problems = [];
      for (const [index, line] of lines.entries()) {
        if (!(line.aligned_seconds >= 0 && line.aligned_seconds <= duration)) {
          problems.push(`line ${index + 1} at ${line.aligned_seconds}s is outside the ${duration}s track`);
        }
        if (index > 0 && line.aligned_seconds < lines[index - 1].aligned_seconds) {
          problems.push(`line ${index + 1} is placed before line ${index}`);
        }
      }
      checks.push(check('lyrics-ordered-and-in-range', !problems.length, problems.join('; ')));
    }
  }

  /* 10 — nothing from the creator's machine leaked into the package */
  {
    const problems = [];
    const textPaths = new Set(['experience.html', 'manifest.json', 'experience.json', 'technical.json']);
    for (const component of components) {
      if (textLike(component.path, component.mime)) textPaths.add(component.path);
    }
    for (const path of textPaths) {
      const content = await readText(path);
      if (content == null) continue;
      for (const { id, re } of CREDENTIAL_PATTERNS) {
        if (re.test(content)) problems.push(`${path} contains something shaped like a credential (${id})`);
      }
      for (const { id, re } of MACHINE_PATH_PATTERNS) {
        const hit = content.match(re);
        if (hit) problems.push(`${path} contains an absolute machine path (${id}): ${hit[0]}`);
      }
    }
    checks.push(check('no-secrets-or-machine-paths', !problems.length, problems.join('; ')));
  }

  return finish(checks);
}

function finish(checks) {
  const failures = checks.filter((entry) => !entry.ok);
  return { ok: !failures.length, checks, failures };
}

/** A single readable sentence for a creator, not a stack trace. */
export function describeFailures(failures) {
  return failures
    .map((failure) => `${failure.id}${failure.detail ? `: ${failure.detail}` : ''}`)
    .join('\n');
}
