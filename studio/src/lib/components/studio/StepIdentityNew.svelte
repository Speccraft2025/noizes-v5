<script>
  import FocusedSection from './FocusedSection.svelte';
  import StudioField from './StudioField.svelte';
  import GenreChips from './GenreChips.svelte';
  import { identity } from '#lib/stores/package.js';
  import { RELEASE_TYPES, RELEASE_TYPE_LABELS } from '#lib/domain/release.js';
  import { currentSection, currentSectionIndex, STEPS, markSectionState, nextSection, prevSection } from '#lib/stores/studio-nav.js';

  const GENRE_SUGGESTIONS = [
    'Afrobeats', 'Amapiano', 'Afro-Soul', 'Afro-Pop', 'Bongo Flava', 'Gengetone',
    'Hip-Hop', 'R&B', 'Jazz', 'Gospel', 'Dancehall', 'Reggae', 'Electronic',
    'House', 'Gqom', 'Highlife', 'Soukous', 'Kwaito', 'Benga', 'Taarab',
    'Soul', 'Neo-Soul', 'Funk', 'Pop', 'Rock', 'Acoustic', 'Classical',
    'Spoken Word', 'Drill', 'Trap', 'Lo-fi', 'Ambient', 'World',
  ];

  const step = STEPS[0];
  const sections = step.sections;

  function setList(field, value) {
    identity.update((current) => ({
      ...current,
      [field]: String(value).split(',').map((entry) => entry.trim()).filter(Boolean),
    }));
  }

  function handleContinue() {
    const sec = $currentSection;
    markSectionState(step.id, sec.id, 'complete');
    nextSection();
  }

  function handleBack() {
    prevSection();
  }

  $: sectionId = $currentSection?.id;
</script>

<!-- Section 1: Release & artists -->
{#if sectionId === 'release-artists'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[0].label}
    sectionNumber={1}
    totalSections={sections.length}
    heading={sections[0].heading}
    subtext={sections[0].subtext}
    showBack={false}
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <StudioField label="Release type">
      <select bind:value={$identity.release_type}>
        {#each RELEASE_TYPES as rt}
          <option value={rt}>{RELEASE_TYPE_LABELS[rt]}</option>
        {/each}
      </select>
    </StudioField>

    <StudioField label="Release title">
      <input
        type="text"
        bind:value={$identity.title}
        placeholder="Single, EP, album, mix, or collection title"
      />
    </StudioField>

    <StudioField label="Primary artist">
      <input
        type="text"
        bind:value={$identity.artist}
        placeholder={$identity.release_type === 'compilation' ? 'Compiler, curator, or release artist' : 'Artist or band name'}
      />
    </StudioField>

    <StudioField label="Featured artists" optional>
      <input
        type="text"
        value={$identity.featured_artists.join(', ')}
        on:input={(e) => setList('featured_artists', e.currentTarget.value)}
        placeholder="Comma-separated"
      />
    </StudioField>

    {#if $identity.release_type === 'compilation'}
      <StudioField label="Compilation artists" optional>
        <input
          type="text"
          value={$identity.compilation_artists.join(', ')}
          on:input={(e) => setList('compilation_artists', e.currentTarget.value)}
          placeholder="Various artists"
        />
      </StudioField>
    {/if}
  </FocusedSection>
{/if}

<!-- Section 2: Label, genres & location -->
{#if sectionId === 'label-genres-location'}
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
    <StudioField label="Label" optional>
      <input
        type="text"
        bind:value={$identity.label}
        placeholder="Independent or label name"
      />
    </StudioField>

    <StudioField label="Genres" hint="Type or tap to toggle">
      <input
        type="text"
        bind:value={$identity.genre}
        placeholder="Afro-Soul, Jazz"
      />
      <GenreChips suggestions={GENRE_SUGGESTIONS} bind:value={$identity.genre} />
    </StudioField>

    <StudioField label="Location" optional>
      <input
        type="text"
        bind:value={$identity.location}
        placeholder="Nairobi, KE"
      />
    </StudioField>

    <StudioField label="Catalogue number" optional>
      <input
        type="text"
        bind:value={$identity.catalogue_number}
        placeholder="NZ-001"
        style="font-family: monospace; font-size: 0.85rem;"
      />
    </StudioField>
  </FocusedSection>
{/if}

<!-- Section 3: Dates & release context -->
{#if sectionId === 'dates-context'}
  <FocusedSection
    stepLabel={step.label}
    sectionLabel={sections[2].label}
    sectionNumber={3}
    totalSections={sections.length}
    heading={sections[2].heading}
    subtext={sections[2].subtext}
    continueLabel="Continue to Assets"
    on:continue={handleContinue}
    on:back={handleBack}
  >
    <div class="date-row">
      <StudioField label="Year">
        <input
          type="number"
          min="1000"
          max="2999"
          bind:value={$identity.year}
          placeholder="2026"
        />
      </StudioField>

      <StudioField label="Release date" optional>
        <input
          type="date"
          bind:value={$identity.release_date}
        />
      </StudioField>
    </div>

    {#if $identity.release_type === 'live_release'}
      <StudioField label="Event name" optional>
        <input type="text" bind:value={$identity.event_name} placeholder="Concert or session" />
      </StudioField>
      <div class="date-row">
        <StudioField label="Venue" optional>
          <input type="text" bind:value={$identity.venue} placeholder="Venue and city" />
        </StudioField>
        <StudioField label="Recording date" optional>
          <input type="date" bind:value={$identity.recording_date} />
        </StudioField>
      </div>
    {/if}

    {#if $identity.release_type === 'compilation'}
      <div class="date-row">
        <StudioField label="Curator" optional>
          <input type="text" bind:value={$identity.curator} />
        </StudioField>
        <StudioField label="Compiler" optional>
          <input type="text" bind:value={$identity.compiler} />
        </StudioField>
      </div>
    {/if}

    <StudioField label="Release statement" optional hint="Context for the complete work">
      <textarea
        rows="4"
        bind:value={$identity.description}
        placeholder="Context for the complete work…"
      ></textarea>
    </StudioField>

    <div class="release-id-row">
      <span class="release-id-label">Stable release ID</span>
      <code class="release-id-value">{$identity.release_id || '—'}</code>
    </div>
  </FocusedSection>
{/if}

<style>
  .date-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .release-id-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-dim);
    border-radius: 10px;
  }

  .release-id-label {
    font-size: 0.78rem;
    color: var(--ink-muted);
    font-weight: 600;
  }

  .release-id-value {
    font-size: 0.78rem;
    color: var(--ink-tertiary);
    font-family: monospace;
  }

  @media (max-width: 600px) {
    .date-row {
      grid-template-columns: 1fr;
      gap: 20px;
    }
  }
</style>
