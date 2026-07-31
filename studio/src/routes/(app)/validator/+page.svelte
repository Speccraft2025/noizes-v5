<script>
  import JSZip from 'jszip';
  import { sha256Hex, validateNzArchive } from '$lib/domain/package-validation.js';

  let dragging = false;
  let result = null;
  let filename = '';

  async function validate(file) {
    filename = file.name;
    result = null;

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        result = await validateProvenance(JSON.parse(await file.text()));
        return;
      }
      const zip = await JSZip.loadAsync(file);
      result = await validateNzArchive(zip, {
        verifySignature: async (authenticity) => {
          try {
            const response = await fetch('/validator/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                hash: authenticity.hash,
                signature: authenticity.signature,
                publicKey: authenticity.signer_public_key,
              }),
            });
            return response.ok && (await response.json()).valid === true;
          } catch {
            return false;
          }
        },
      });
    } catch (e) {
      result = { valid: false, error: e.message, checks: [], manifest: null, summary: { passed: 0, failed: 1, warned: 0 } };
    }
  }

  const EVENT_FIELDS = ['release_id', 'edition_number', 'seq', 'kind', 'from_owner_id', 'to_owner_id', 'price', 'currency', 'note', 'occurred_at', 'prev_hash'];

  async function validateProvenance(doc) {
    const checks = [];
    const events = Array.isArray(doc?.events) ? [...doc.events].sort((a, b) => a.seq - b.seq) : [];
    checks.push({ label: 'document type', status: doc?.kind === 'noizes-provenance' ? 'pass' : 'fail', note: doc?.kind || 'Missing kind' });
    checks.push({ label: 'event chain', status: events.length ? 'pass' : 'fail', note: events.length ? `${events.length} events` : 'Chain is empty' });

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const canonical = {};
      for (const field of EVENT_FIELDS) canonical[field] = event[field] === undefined ? null : event[field];
      const contentHash = await sha256Hex(new TextEncoder().encode(JSON.stringify(canonical)));
      const linked = i === 0
        ? event.seq === 0 && event.kind === 'created' && event.prev_hash == null
        : event.seq === i && event.prev_hash === events[i - 1].content_hash;
      const hashValid = contentHash === event.content_hash;
      const signatureValid = hashValid && await verifyEd25519(event.content_hash, event.signature, event.signer_public_key);
      checks.push({
        label: `event ${event.seq}`,
        status: linked && hashValid && signatureValid ? 'pass' : 'fail',
        note: !linked ? 'Broken chain link' : !hashValid ? 'Content hash mismatch' : !signatureValid ? 'Invalid signature' : `${event.kind} verified`,
      });
    }

    const failed = checks.filter((check) => check.status === 'fail').length;
    return {
      valid: failed === 0,
      checks,
      manifest: { title: doc?.title, artist: doc?.artist, edition_number: doc?.edition_number, schema_version: doc?.schema_version },
      summary: { passed: checks.length - failed, failed, warned: 0 },
    };
  }

  async function verifyEd25519(hash, signature, publicKey) {
    try {
      const decode = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
      const key = await crypto.subtle.importKey('spki', decode(publicKey), { name: 'Ed25519' }, false, ['verify']);
      return crypto.subtle.verify({ name: 'Ed25519' }, key, decode(signature), Uint8Array.from(hash.match(/.{2}/g), (byte) => parseInt(byte, 16)));
    } catch {
      return false;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) validate(file);
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
    <p class="text-base" style="color: var(--ink-muted);">Validate a .nz package or verify a provenance.json chain entirely in your browser.</p>
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
    <p class="t-caption mb-2">.nz · .zip · provenance.json</p>
    <p class="text-sm" style="color: var(--ink-muted);">Drop package here or <span class="text-white underline">browse</span></p>
    <input type="file" class="hidden" accept=".nz,.zip,.json,application/json" on:change={(e) => { const f = e.target.files?.[0]; if (f) validate(f); }} />
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
