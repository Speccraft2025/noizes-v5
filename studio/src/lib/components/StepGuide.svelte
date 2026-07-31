<script>
  import { assets, extras, play, template } from '$lib/stores/package.js';

  const NODE_DEFS = {
    arrival: { type: 'arrival', label: 'Arrival', view: 'intro', hint: 'A cinematic welcome into the release.' },
    object:  { type: 'object', label: 'The Object', view: 'intro', hint: 'Edition, ownership and object context.' },
    listen:  { type: 'listen', label: 'Listen', view: 'view-player', hint: 'The heart of the experience: the music.' },
    lyrics:  { type: 'lyrics', label: 'Lyrics', view: 'view-lyrics', hint: 'Time-synced words alongside the track.' },
    play:    { type: 'interactive', label: 'Play', view: 'view-games', hint: 'Beat-synced interactive moments.' },
    story:   { type: 'narrative', label: 'Artist Statement', view: 'intro', hint: 'The story or liner note behind the work.' },
    notes:   { type: 'notes', label: 'Note Wall', view: 'view-notes', hint: 'A wall of embedded PDF notes and booklets.' },
    record:  { type: 'record', label: 'Collector Record', view: 'intro', hint: 'Provenance and the life of the object.' },
    end:     { type: 'ending', label: 'End', view: 'view-player', hint: 'A closing moment that returns to the music.' }
  };

  const DEFAULT_ORDER = ['arrival', 'object', 'listen', 'lyrics', 'story', 'notes', 'play', 'record', 'end'];
  const REQUIRED = new Set(['listen']);

  function isAvailable(id) {
    if (id === 'lyrics') return !!($assets.lyrics && $assets.lyrics.length);
    if (id === 'play') return !!($play.games && $play.games.length);
    if (id === 'story') return !!$extras.story?.trim();
    if (id === 'notes') return !!$extras.pdfs?.length;
    return true;
  }

  $: availableIds = DEFAULT_ORDER.filter(isAvailable);
  $: nodes = $assets.guide?.nodes || [];
  $: enabledIds = new Set(nodes.map((node) => node.id));

  // Theme variants are archived for now; every newly authored experience uses ULTRA.
  $: if ($template !== 'ultra-v2') template.set('ultra-v2');

  function updateGuide(nodes, allowFreeExplore = $assets.guide?.allowFreeExplore !== false) {
    assets.update((value) => ({
      ...value,
      guide: { version: 1, allowFreeExplore, nodes }
    }));
  }

  function toggle(id) {
    if (REQUIRED.has(id)) return;
    if (enabledIds.has(id)) {
      updateGuide(nodes.filter((node) => node.id !== id));
      return;
    }
    const def = NODE_DEFS[id];
    const next = [...nodes, { id, type: def.type, label: def.label, view: def.view }];
    next.sort((a, b) => DEFAULT_ORDER.indexOf(a.id) - DEFAULT_ORDER.indexOf(b.id));
    updateGuide(next);
  }

  function rename(id, label) {
    updateGuide(nodes.map((node) => node.id === id ? { ...node, label } : node));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return;
    const next = [...nodes];
    [next[index], next[target]] = [next[target], next[index]];
    updateGuide(next);
  }

  function setFreeExplore(allowFreeExplore) {
    updateGuide(nodes, allowFreeExplore);
  }
</script>

<div class="space-y-5">
  <div>
    <p class="t-caption mb-2">Step 6</p>
    <h2 class="text-2xl font-black tracking-tight text-white">Guided experience</h2>
    <p class="text-sm mt-1" style="color: var(--ink-muted);">
      Shape the journey listeners take through your music. Rename, reorder and choose each moment.
    </p>
  </div>

  <div class="rounded-2xl p-4" style="background: rgba(123,92,240,.08); border: 1px solid rgba(123,92,240,.25);">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-sm font-bold text-white">Let listeners wander</p>
        <p class="text-xs mt-1" style="color: var(--ink-muted);">They can leave your path and explore any available section.</p>
      </div>
      <button type="button" role="switch" aria-label="Let listeners wander" aria-checked={$assets.guide?.allowFreeExplore !== false}
        class="w-11 h-6 rounded-full p-1 transition-colors shrink-0"
        style="background: {$assets.guide?.allowFreeExplore !== false ? '#7B5CF0' : 'rgba(255,255,255,.12)'};"
        on:click={() => setFreeExplore($assets.guide?.allowFreeExplore === false)}>
        <span class="block w-4 h-4 rounded-full bg-white transition-transform"
          style="transform: translateX({$assets.guide?.allowFreeExplore !== false ? '20px' : '0'});"></span>
      </button>
    </div>
  </div>

  <div>
    <div class="flex items-center justify-between mb-3">
      <p class="t-caption">Journey · {nodes.length} moments</p>
      <span class="text-xs font-mono" style="color: var(--ink-muted);">ULTRA immersive player</span>
    </div>

    <div class="space-y-2">
      {#each nodes as node, index (node.id)}
        <div class="rounded-xl p-3" style="background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08);">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
              style="background: rgba(123,92,240,.18); color: #9a82ff;">{index + 1}</span>
            <div class="flex-1 min-w-0">
              <input class="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-violet-500 py-0.5"
                value={node.label} aria-label="{NODE_DEFS[node.id].label} label"
                on:input={(event) => rename(node.id, event.currentTarget.value)} />
              <p class="text-xs mt-1" style="color: var(--ink-muted);">{NODE_DEFS[node.id].hint}</p>
            </div>
            <div class="flex gap-1 shrink-0">
              <button type="button" class="w-7 h-7 rounded-lg text-xs disabled:opacity-20"
                style="background: rgba(255,255,255,.06); color: #fff;" disabled={index === 0}
                aria-label="Move {node.label} up" on:click={() => move(index, -1)}>↑</button>
              <button type="button" class="w-7 h-7 rounded-lg text-xs disabled:opacity-20"
                style="background: rgba(255,255,255,.06); color: #fff;" disabled={index === nodes.length - 1}
                aria-label="Move {node.label} down" on:click={() => move(index, 1)}>↓</button>
              <button type="button" class="w-7 h-7 rounded-lg text-xs disabled:opacity-20"
                style="background: rgba(240,75,107,.1); color: #F06B82;" disabled={REQUIRED.has(node.id)}
                aria-label="Remove {node.label}" on:click={() => toggle(node.id)}>×</button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if availableIds.some((id) => !enabledIds.has(id))}
    <div>
      <p class="t-caption mb-3">Add a moment</p>
      <div class="flex flex-wrap gap-2">
        {#each availableIds.filter((id) => !enabledIds.has(id)) as id}
          <button type="button" class="px-3 py-2 rounded-lg text-xs font-bold"
            style="background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: #fff;"
            on:click={() => toggle(id)}>＋ {NODE_DEFS[id].label}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if !$assets.lyrics?.length || !$play.games?.length}
    <p class="text-xs leading-relaxed" style="color: var(--ink-muted);">
      Add lyrics, an artist statement, or games in earlier steps to unlock more moments for this journey.
    </p>
  {/if}
</div>
