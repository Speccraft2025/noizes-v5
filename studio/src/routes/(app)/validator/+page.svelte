<script>
  import JSZip from 'jszip';

  let dragging = false;
  let result = null;
  let filename = '';

  const REQUIRED = ['manifest.json', 'edition.json', 'experience.html'];
  const OPTIONAL = ['rights.json', 'credits.json', 'authenticity.json', 'technical.json'];

  async function validate(file) {
    filename = file.name;
    result = null;
    const checks = [];

    try {
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files);

      for (const req of REQUIRED) {
        const found = files.some(f => f === req || f.endsWith('/' + req));
        checks.push({ label: req, status: found ? 'pass' : 'fail', note: found ? 'Present' : 'Missing — required' });
      }
      for (const opt of OPTIONAL) {
        const found = files.some(f => f === opt || f.endsWith('/' + opt));
        checks.push({ label: opt, status: found ? 'pass' : 'warn', note: found ? 'Present' : 'Missing — optional' });
      }

      const hasAudio = files.some(f => f.startsWith('audio/') && !zip.files[f].dir);
      checks.push({ label: 'audio/ folder', status: hasAudio ? 'pass' : 'warn', note: hasAudio ? 'Audio file present' : 'No audio files' });

      let manifest = null;
      const mf = zip.file('manifest.json');
      if (mf) {
        try {
          manifest = JSON.parse(await mf.async('string'));
          const hasV = !!manifest.noizes_version;
          checks.push({ label: 'noizes_version field', status: hasV ? 'pass' : 'fail', note: hasV ? manifest.noizes_version : 'Missing' });
        } catch {
          checks.push({ label: 'noizes_version field', status: 'fail', note: 'Invalid JSON' });
        }
      } else {
        checks.push({ label: 'noizes_version field', status: 'fail', note: 'No manifest.json' });
      }

      // Authenticity: recompute the audio hash and verify the platform signature.
      const af = zip.file('authenticity.json');
      if (af) {
        try {
          const authenticity = JSON.parse(await af.async('string'));
          const audioEntry = files.find(f => f.startsWith('audio/') && !zip.files[f].dir);

          if (audioEntry && authenticity.hash) {
            const audioBuf = await zip.files[audioEntry].async('arraybuffer');
            const computedHash = await sha256Hex(audioBuf);
            const match = computedHash === authenticity.hash;
            checks.push({ label: 'audio hash matches authenticity.json', status: match ? 'pass' : 'fail', note: match ? 'sha256 verified' : 'Hash mismatch — audio may have been altered' });
          } else if (authenticity.hash) {
            checks.push({ label: 'audio hash matches authenticity.json', status: 'warn', note: 'No audio file to verify against' });
          }

          if (authenticity.signed) {
            try {
              const res = await fetch('/validator/verify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  hash: authenticity.hash,
                  signature: authenticity.signature,
                  publicKey: authenticity.signer_public_key,
                }),
              });
              const { valid } = await res.json();
              checks.push({ label: 'platform signature', status: valid ? 'pass' : 'fail', note: valid ? 'Signature valid' : 'Signature invalid' });
            } catch {
              checks.push({ label: 'platform signature', status: 'warn', note: 'Could not reach verification service' });
            }
          } else {
            checks.push({ label: 'platform signature', status: 'warn', note: 'Not signed (unpublished export)' });
          }
        } catch {
          checks.push({ label: 'authenticity.json', status: 'fail', note: 'Invalid JSON' });
        }
      }

      const passed = checks.filter(c => c.status === 'pass').length;
      const failed = checks.filter(c => c.status === 'fail').length;
      const warned = checks.filter(c => c.status === 'warn').length;
      result = { valid: failed === 0, checks, manifest, summary: { passed, failed, warned } };
    } catch (e) {
      result = { valid: false, error: e.message, checks: [], manifest: null, summary: { passed: 0, failed: 1, warned: 0 } };
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) validate(file);
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const statusStyle = {
    pass:  { color: '#4ade80', icon: '✓', bg: 'rgba(74,222,128,0.08)' },
    fail:  { color: '#f87171', icon: '✗', bg: 'rgba(248,113,113,0.08)' },
    warn:  { color: '#c8a96e', icon: '○', bg: 'rgba(200,169,110,0.08)' },
  };
</script>

<div class="max-w-3xl mx-auto px-6 py-8">
  <div class="mb-10">
    <p class="t-caption mb-2">Inspector</p>
    <h1 class="t-monumental-small text-white mb-2">Validator</h1>
    <p class="text-base" style="color: var(--ink-muted);">Drop a .nz package to inspect and validate its structure.</p>
  </div>

  <!-- Drop zone -->
  <label
    class="glass rounded-2xl flex flex-col items-center justify-center py-20 cursor-pointer mb-8 transition-all duration-300"
    style={dragging ? 'border-color: #7B5CF0; background: rgba(123,92,240,0.08);' : 'border-style: dashed;'}
    on:dragover|preventDefault={() => dragging = true}
    on:dragleave={() => dragging = false}
    on:drop={handleDrop}
  >
    <div class="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-300"
      style={dragging ? 'background: var(--gradient-spectral);' : 'background: rgba(123,92,240,0.12); border: 1px solid rgba(123,92,240,0.25);'}>
      <span class="text-2xl" style="color: #7B5CF0;">⬡</span>
    </div>
    <p class="t-caption mb-2">.nz · .zip</p>
    <p class="text-sm" style="color: var(--ink-muted);">Drop package here or <span class="text-white underline">browse</span></p>
    <input type="file" class="hidden" accept=".nz,.zip" on:change={(e) => { const f = e.target.files?.[0]; if (f) validate(f); }} />
  </label>

  {#if result}
    <!-- Result header -->
    <div class="glass rounded-2xl p-5 mb-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="t-caption mb-1">{filename}</p>
          <h2 class="text-xl font-black" style="color: {result.valid ? '#4ade80' : '#f87171'};">
            {result.valid ? '✓ Valid Package' : '✗ Invalid Package'}
          </h2>
        </div>
        <div class="text-right space-y-1">
          <p class="text-xs font-mono" style="color: #4ade80;">{result.summary.passed} passed</p>
          {#if result.summary.failed > 0}<p class="text-xs font-mono" style="color: #f87171;">{result.summary.failed} failed</p>{/if}
          {#if result.summary.warned > 0}<p class="text-xs font-mono" style="color: #c8a96e;">{result.summary.warned} warnings</p>{/if}
        </div>
      </div>

      {#if result.error}
        <div class="rounded-lg px-4 py-3 text-sm font-mono" style="background: rgba(248,113,113,0.08); color: #f87171;">{result.error}</div>
      {/if}

      <!-- Checks -->
      <div class="space-y-1">
        {#each result.checks as check}
          <div class="flex items-center gap-4 px-4 py-2.5 rounded-lg" style="background: {statusStyle[check.status].bg};">
            <span class="text-sm font-black w-4 shrink-0" style="color: {statusStyle[check.status].color};">{statusStyle[check.status].icon}</span>
            <span class="font-mono text-xs flex-1 text-white">{check.label}</span>
            <span class="text-xs" style="color: var(--ink-muted);">{check.note}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Manifest preview -->
    {#if result.manifest}
      <div class="glass rounded-2xl overflow-hidden">
        <div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--border-dim);">
          <span class="text-xs font-black uppercase tracking-widest" style="color: #7B5CF0;">⬡</span>
          <span class="t-caption">manifest.json</span>
        </div>
        <div class="p-4 overflow-auto max-h-72" style="background: #030303;">
          <pre class="font-mono text-xs leading-relaxed" style="color: rgba(139,92,246,0.9);">{JSON.stringify(result.manifest, null, 2)}</pre>
        </div>
      </div>
    {/if}
  {/if}
</div>
