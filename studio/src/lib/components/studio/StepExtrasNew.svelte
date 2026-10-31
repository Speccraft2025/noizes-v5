<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import { extras, releaseProject } from '#lib/stores/package.js';
  import { currentSection, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const step = STEPS[3];
  const sections = step.sections;

  function addLink() {
    extras.update((v) => ({ ...v, links: [...v.links, { id: crypto.randomUUID(), label: '', url: '', kind: 'artist' }] }));
  }
  function updateLink(id, patch) {
    extras.update((v) => ({ ...v, links: v.links.map((l) => l.id === id ? { ...l, ...patch } : l) }));
  }
  function removeLink(id) {
    extras.update((v) => ({ ...v, links: v.links.filter((l) => l.id !== id) }));
  }
  function addPdfs(event) {
    const files = [...(event.currentTarget.files || [])].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    extras.update((v) => ({ ...v, pdfs: [...v.pdfs, ...files.map((f) => ({ id: crypto.randomUUID(), title: f.name.replace(/\.pdf$/i, ''), name: f.name, file: f }))] }));
    event.currentTarget.value = '';
  }
  function renamePdf(id, title) {
    extras.update((v) => ({ ...v, pdfs: v.pdfs.map((p) => p.id === id ? { ...p, title } : p) }));
  }
  function removePdf(id) {
    extras.update((v) => ({ ...v, pdfs: v.pdfs.filter((p) => p.id !== id) }));
    releaseProject.update((p) => ({
      ...p,
      rights: { ...p.rights, asset_permissions: (p.rights.asset_permissions || []).filter((perm) => perm.asset_id !== id) },
    }));
  }

  function handleContinue() {
    markSectionState(step.id, $currentSection.id, 'complete');
    nextSection();
  }
  function handleBack() { prevSection(); }

  $: sectionId = $currentSection?.id;
</script>

{#if sectionId === 'supplementary'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <StudioField label="Artist statement or liner note" optional hint="Tell listeners what lives behind this work">
      <textarea rows="6" bind:value={$extras.story} maxlength="20000" placeholder="Tell listeners what lives behind this work…"></textarea>
    </StudioField>

    <div class="pdf-section">
      <div class="pdf-header">
        <div>
          <p class="pdf-title">Note wall</p>
          <p class="pdf-hint">PDF liner notes become tactile objects pinned inside the experience.</p>
        </div>
      </div>
      <label class="pdf-drop">
        <span class="pdf-drop-icon">▤</span>
        <span class="pdf-drop-text">Add PDF notes</span>
        <input type="file" class="sr-only" accept="application/pdf,.pdf" multiple on:change={addPdfs} />
      </label>
      {#each $extras.pdfs as pdf (pdf.id)}
        <div class="pdf-row">
          <span class="pdf-row-icon">▤</span>
          <div class="pdf-row-info">
            <input class="pdf-row-title" value={pdf.title} on:input={(e) => renamePdf(pdf.id, e.currentTarget.value)} />
            <p class="pdf-row-name">{pdf.name}</p>
          </div>
          <button type="button" class="pdf-row-remove" on:click={() => removePdf(pdf.id)}>Remove</button>
        </div>
      {/each}
    </div>
  </FocusedSection>
{/if}

{#if sectionId === 'links-games'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[1].label}
    sectionNumber={2}
    totalSections={sections.length}
    heading={sections[1].heading}
    subtext={sections[1].subtext}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="links-header">
      <p class="links-note">Collectors are warned before leaving the offline object.</p>
      <button type="button" class="links-add" on:click={addLink}>+ Add link</button>
    </div>

    {#each $extras.links as link (link.id)}
      <div class="link-card">
        <div class="link-card-row">
          <input class="link-input" value={link.label} placeholder="Merch, tickets, artist site…" on:input={(e) => updateLink(link.id, { label: e.currentTarget.value })} />
          <select class="link-select" value={link.kind} on:change={(e) => updateLink(link.id, { kind: e.currentTarget.value })}>
            <option value="artist">Artist</option><option value="merch">Merch</option><option value="tickets">Tickets</option><option value="platform">Platform</option>
          </select>
        </div>
        <div class="link-card-row">
          <input class="link-input link-url" value={link.url} placeholder="https://…" on:input={(e) => updateLink(link.id, { url: e.currentTarget.value })} />
          <button type="button" class="link-remove" on:click={() => removeLink(link.id)}>Remove</button>
        </div>
      </div>
    {/each}

    {#if !$extras.links.length}
      <div class="empty-state">No links added. Collectors will have a fully offline experience.</div>
    {/if}
  </FocusedSection>
{/if}

{#if sectionId === 'review-extras'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Experience"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="extras-review">
      <div class="extras-review-row">
        <span class="extras-review-label">Artist statement</span>
        <span class="extras-review-value">{$extras.story ? `${$extras.story.length} characters` : 'None'}</span>
      </div>
      <div class="extras-review-row">
        <span class="extras-review-label">PDF notes</span>
        <span class="extras-review-value">{$extras.pdfs.length} {$extras.pdfs.length === 1 ? 'document' : 'documents'}</span>
      </div>
      <div class="extras-review-row">
        <span class="extras-review-label">Online links</span>
        <span class="extras-review-value">{$extras.links.length} {$extras.links.length === 1 ? 'link' : 'links'}</span>
      </div>
    </div>
  </FocusedSection>
{/if}

<style>
  .pdf-section { display: flex; flex-direction: column; gap: 10px; }
  .pdf-header { display: flex; align-items: flex-start; justify-content: space-between; }
  .pdf-title { font-size: 0.82rem; font-weight: 700; color: var(--ink-secondary); margin: 0; }
  .pdf-hint { font-size: 0.72rem; color: var(--ink-muted); margin: 4px 0 0; }

  .pdf-drop {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 20px; border: 1px dashed var(--border-dim); border-radius: 12px;
    cursor: pointer; transition: border-color 0.2s;
  }
  .pdf-drop:hover { border-color: var(--border-hover); }
  .pdf-drop-icon { color: var(--spectral-violet); font-size: 1.1rem; }
  .pdf-drop-text { font-size: 0.88rem; color: #fff; font-weight: 600; }

  .pdf-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 10px;
  }
  .pdf-row-icon { color: var(--spectral-violet); flex-shrink: 0; }
  .pdf-row-info { flex: 1; min-width: 0; }
  .pdf-row-title { width: 100%; background: transparent; border: none; font-size: 0.85rem; font-weight: 700; color: #fff; outline: none; }
  .pdf-row-name { font-size: 0.7rem; color: var(--ink-muted); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pdf-row-remove { background: none; border: none; font-size: 0.75rem; color: var(--ink-muted); cursor: pointer; padding: 4px 8px; }
  .pdf-row-remove:hover { color: #F08A9D; }

  .links-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .links-note { font-size: 0.78rem; color: var(--ink-muted); margin: 0; }
  .links-add {
    background: none; border: 1px solid var(--border-dim); border-radius: 8px;
    color: var(--ink-secondary); font-size: 0.78rem; font-weight: 600; padding: 6px 14px; cursor: pointer;
    transition: border-color 0.2s, color 0.2s; white-space: nowrap;
  }
  .links-add:hover { border-color: var(--border-hover); color: #fff; }

  .link-card {
    display: flex; flex-direction: column; gap: 8px;
    padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); border-radius: 12px;
  }
  .link-card-row { display: flex; gap: 8px; }
  .link-input {
    flex: 1; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim);
    border-radius: 8px; color: #fff; font-size: 0.85rem; font-family: inherit; outline: none;
  }
  .link-input:focus { border-color: var(--spectral-violet); }
  .link-input::placeholder { color: var(--ink-muted); opacity: 0.7; }
  .link-url { font-family: monospace; font-size: 0.8rem; }
  .link-select {
    width: 110px; padding: 10px 8px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-dim);
    border-radius: 8px; color: var(--ink-secondary); font-size: 0.82rem; font-family: inherit; outline: none;
  }
  .link-select option { background: var(--charcoal); color: #fff; }
  .link-remove { background: none; border: none; font-size: 0.78rem; color: var(--ink-muted); cursor: pointer; padding: 6px 10px; white-space: nowrap; }
  .link-remove:hover { color: #F08A9D; }

  .empty-state {
    padding: 32px 24px; text-align: center; color: var(--ink-muted); font-size: 0.85rem;
    background: rgba(255,255,255,0.02); border: 1px dashed var(--border-dim); border-radius: 12px;
  }

  .extras-review { display: flex; flex-direction: column; gap: 2px; }
  .extras-review-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; background: rgba(255,255,255,0.02); border-radius: 10px;
  }
  .extras-review-label { font-size: 0.85rem; font-weight: 600; color: #fff; }
  .extras-review-value { font-size: 0.82rem; color: var(--ink-muted); }

  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
