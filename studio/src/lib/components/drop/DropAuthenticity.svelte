<script>
  import { describeVerificationStatus } from '$lib/domain/drop-contents.js';

  // Authenticity here means one specific, checkable thing: the creator signed
  // a hash of the package's component inventory, and the signature verifies.
  // It is not a claim about who owns the copyright, and the page says so —
  // conflating the two is the single most common misreading of a signed
  // cultural object, and it is not one to leave to inference.
  export let authenticity = null;
  export let packageRecord = null;
  export let release;
  export let certificateHref = '';
  export let manifestHref = '';

  function shorten(value, head = 10, tail = 6) {
    const text = String(value ?? '');
    return text.length > head + tail + 1 ? `${text.slice(0, head)}…${text.slice(-tail)}` : text;
  }

  // Derived in $lib/domain/drop-contents.js so the trust strip and this panel
  // cannot drift into disagreeing about the same package.
  $: ({ signature, validation } = describeVerificationStatus({ authenticity, packageRecord }));

  const TONE = { good: '#7B5CF0', bad: '#F0A0A0', unknown: 'var(--ink-muted)' };
  $: rows = [
    ['Release ID', release.id, release.id],
    ['Package ID', packageRecord?.id, packageRecord?.id],
    ['Package version', packageRecord?.version ? `v${packageRecord.version}` : null, null],
    ['Signature method', authenticity?.method, null],
    ['Signature algorithm', authenticity?.signature_type, null],
    ['Inventory hash', authenticity?.content_hash ? shorten(authenticity.content_hash, 12, 8) : null, authenticity?.content_hash],
    ['Manifest hash', packageRecord?.manifest_hash ? shorten(packageRecord.manifest_hash, 12, 8) : null, packageRecord?.manifest_hash],
    ['Package hash', packageRecord?.package_hash ? shorten(packageRecord.package_hash, 12, 8) : null, packageRecord?.package_hash],
    ['Signing key', authenticity?.signer_public_key ? shorten(authenticity.signer_public_key, 12, 8) : null, authenticity?.signer_public_key],
    ['Validated', packageRecord?.validated_at?.slice(0, 10), null],
  ].filter(([, value]) => value);
</script>

<section aria-labelledby="drop-authenticity-heading" class="space-y-5">
  <div>
    <p class="t-caption mb-1.5">Verification</p>
    <h2 id="drop-authenticity-heading" class="text-2xl font-black text-white tracking-tight">Authenticity</h2>
  </div>

  <div class="glass rounded-2xl p-6 space-y-5">
    <!-- Status is stated in words and backed by an icon, never by colour
         alone. -->
    <div class="flex flex-wrap gap-3">
      {#each [signature, validation] as status}
        <p class="inline-flex items-center gap-2 text-sm font-bold" style="color: {TONE[status.tone]};">
          <span aria-hidden="true">{status.icon}</span>
          {status.label}
        </p>
      {/each}
    </div>

    {#if validation.tone === 'bad'}
      <!-- A failed check is worth a sentence, not just a label: the reader's
           next question is whether the object is safe to acquire. -->
      <p class="text-xs leading-relaxed rounded-xl px-4 py-3"
        style="background: rgba(240,160,160,.07); border: 1px solid rgba(240,160,160,.2); color: var(--ink-secondary);">
        This package did not pass every structural check. Its contents and signature are recorded above and can still be
        inspected, but it is not certified as a clean Noizes package. Ask the creator to republish it before relying on it.
      </p>
    {/if}

    {#if rows.length}
      <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {#each rows as [label, display, full] (label)}
          <div class="min-w-0">
            <dt class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--ink-muted);">{label}</dt>
            <dd class="text-xs font-mono text-white truncate" title={full || display}>{display}</dd>
          </div>
        {/each}
      </dl>
    {/if}

    <div class="flex flex-wrap gap-2 pt-1">
      {#if certificateHref}
        <a class="btn-ghost rounded-full px-4 py-2 text-xs" href={certificateHref} download>View certificate</a>
      {/if}
      {#if manifestHref}
        <a class="btn-ghost rounded-full px-4 py-2 text-xs" href={manifestHref} download>View manifest</a>
      {/if}
      <a class="btn-ghost rounded-full px-4 py-2 text-xs" href="/validator">Verify a package</a>
    </div>

    <p class="text-xs leading-relaxed pt-1" style="color: var(--ink-muted); border-top: 1px solid var(--border-dim); padding-top: 1rem;">
      A signature proves this package's contents are the ones the creator sealed, and that they have not changed since.
      It is not a copyright registration, and it does not by itself establish who owns the underlying work.
      Verification runs against hashes and signatures held in the package itself — no ledger, no chain, and no
      connection to Noizes is required to check it.
    </p>
  </div>
</section>
