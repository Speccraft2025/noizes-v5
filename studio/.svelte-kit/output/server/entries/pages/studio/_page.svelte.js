import { c as create_ssr_component, s as subscribe, d as add_attribute, e as escape, b as each, v as validate_component } from "../../../chunks/ssr.js";
import { w as writable, d as derived } from "../../../chunks/index.js";
import "jszip";
const identity = writable({
  artist: "",
  title: "",
  release_id: "",
  year: (/* @__PURE__ */ new Date()).getFullYear().toString(),
  genre: "",
  location: "",
  description: ""
});
const assets = writable({
  audioFile: null,
  coverFile: null,
  lyricsFile: null,
  audioName: "",
  coverName: "",
  lyricsName: ""
});
const edition = writable({
  edition_name: "",
  edition_type: "Open Edition",
  edition_size: "",
  price: "",
  currency: "KES",
  transferable: true
});
const rights = writable({
  copyright: "",
  license: "All Rights Reserved",
  producer: "",
  credits: ""
});
const manifest = derived(
  [identity, edition, rights],
  ([$identity, $edition, $rights]) => ({
    noizes_version: "1.0.0",
    package_type: "music",
    artist: $identity.artist,
    title: $identity.title,
    release_id: $identity.release_id || `nz-${Date.now()}`,
    year: $identity.year,
    genre: $identity.genre,
    location: $identity.location,
    description: $identity.description,
    edition_type: $edition.edition_type,
    edition_name: $edition.edition_name,
    edition_size: $edition.edition_size || "unlimited",
    price: $edition.price,
    currency: $edition.currency,
    copyright: $rights.copyright,
    license: $rights.license,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  })
);
function buildExperienceHTML({ identity: identity2, edition: edition2, rights: rights2, audioName, coverBase64, coverMime }) {
  const audioSrc = audioName ? `audio/${audioName}` : null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(identity2.title)} — ${escHtml(identity2.artist)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0e0e0e;
    --paper: #f5f2ec;
    --gold: #c8a96e;
    --surface: #1a1a1a;
    --muted: #888;
  }
  body {
    background: var(--ink);
    color: var(--paper);
    font-family: Georgia, 'Times New Roman', serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
  }
  .container { max-width: 640px; width: 100%; }
  .cover {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
    margin-bottom: 32px;
    background: #1a1a1a;
  }
  .cover-placeholder {
    width: 100%;
    aspect-ratio: 1;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32px;
    color: var(--muted);
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }
  h1 {
    font-size: clamp(24px, 6vw, 40px);
    font-weight: normal;
    line-height: 1.1;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }
  .artist {
    font-size: 16px;
    color: var(--gold);
    margin-bottom: 24px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .meta {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    flex-wrap: wrap;
  }
  .description {
    font-size: 15px;
    line-height: 1.7;
    color: #ccc;
    margin-bottom: 40px;
  }
  audio {
    width: 100%;
    margin-bottom: 40px;
    accent-color: var(--gold);
  }
  audio::-webkit-media-controls-panel { background: #1a1a1a; }
  .section-title {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2a2a2a;
  }
  .record {
    background: var(--surface);
    padding: 20px;
    margin-bottom: 24px;
  }
  .record-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #2a2a2a;
    font-size: 13px;
  }
  .record-row:last-child { border-bottom: none; }
  .record-key {
    font-family: 'Courier New', monospace;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .record-val { color: var(--paper); font-family: 'Courier New', monospace; font-size: 12px; }
  footer {
    margin-top: 48px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #444;
    text-align: center;
    letter-spacing: 0.1em;
  }
</style>
</head>
<body>
<div class="container">
  ${`<div class="cover-placeholder">[ no cover art ]</div>`}

  <div class="artist">${escHtml(identity2.artist)}</div>
  <h1>${escHtml(identity2.title)}</h1>
  <div class="meta">
    ${identity2.year ? `<span>${escHtml(identity2.year)}</span>` : ""}
    ${identity2.genre ? `<span>${escHtml(identity2.genre)}</span>` : ""}
    ${identity2.location ? `<span>${escHtml(identity2.location)}</span>` : ""}
  </div>

  ${identity2.description ? `<p class="description">${escHtml(identity2.description)}</p>` : ""}

  ${audioSrc ? `
  <audio controls>
    <source src="${escHtml(audioSrc)}" />
    Your browser does not support the audio element.
  </audio>
  ` : ""}

  <div class="section-title">Edition Record</div>
  <div class="record">
    <div class="record-row"><span class="record-key">Edition</span><span class="record-val">${escHtml(edition2.edition_name || edition2.edition_type)}</span></div>
    <div class="record-row"><span class="record-key">Type</span><span class="record-val">${escHtml(edition2.edition_type)}</span></div>
    ${edition2.edition_size ? `<div class="record-row"><span class="record-key">Size</span><span class="record-val">${escHtml(edition2.edition_size)} copies</span></div>` : ""}
    ${edition2.price ? `<div class="record-row"><span class="record-key">Price</span><span class="record-val">${escHtml(edition2.currency)} ${escHtml(edition2.price)}</span></div>` : ""}
    <div class="record-row"><span class="record-key">Transferable</span><span class="record-val">${edition2.transferable ? "Yes" : "No"}</span></div>
  </div>

  <div class="section-title">Provenance</div>
  <div class="record">
    <div class="record-row"><span class="record-key">Copyright</span><span class="record-val">${escHtml(rights2.copyright || "—")}</span></div>
    <div class="record-row"><span class="record-key">License</span><span class="record-val">${escHtml(rights2.license)}</span></div>
    ${rights2.producer ? `<div class="record-row"><span class="record-key">Producer</span><span class="record-val">${escHtml(rights2.producer)}</span></div>` : ""}
    ${rights2.credits ? `<div class="record-row"><span class="record-key">Credits</span><span class="record-val">${escHtml(rights2.credits)}</span></div>` : ""}
  </div>

  <footer>Packaged with Noizes · noizes_version 1.0.0</footer>
</div>
</body>
</html>`;
}
function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const StepIdentity = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $identity, $$unsubscribe_identity;
  $$unsubscribe_identity = subscribe(identity, (value) => $identity = value);
  $$unsubscribe_identity();
  return `<div class="space-y-5"><div data-svelte-h="svelte-ryh01c"><p class="t-caption mb-2">Step 1</p> <h2 class="text-2xl font-black tracking-tight text-white">Identity</h2> <p class="text-sm mt-1" style="color: var(--ink-muted);">Define the work&#39;s core metadata.</p></div> <div><label class="label-dark" for="artist" data-svelte-h="svelte-15r2ptk">Artist *</label> <input id="artist" class="input-dark" type="text" placeholder="Artist or band name"${add_attribute("value", $identity.artist, 0)}></div> <div><label class="label-dark" for="title" data-svelte-h="svelte-i603eg">Title *</label> <input id="title" class="input-dark" type="text" placeholder="Track or album title"${add_attribute("value", $identity.title, 0)}></div> <div class="grid grid-cols-2 gap-3"><div><label class="label-dark" for="release_id" data-svelte-h="svelte-fc9zat">Release ID</label> <input id="release_id" class="input-dark font-mono text-xs" type="text" placeholder="nz-XXXXXX"${add_attribute("value", $identity.release_id, 0)}></div> <div><label class="label-dark" for="year" data-svelte-h="svelte-1kzab7o">Year *</label> <input id="year" class="input-dark" type="number" min="1900" max="2100" placeholder="2024"${add_attribute("value", $identity.year, 0)}></div></div> <div class="grid grid-cols-2 gap-3"><div><label class="label-dark" for="genre" data-svelte-h="svelte-ky1q1s">Genre</label> <input id="genre" class="input-dark" type="text" placeholder="e.g. Afro-Soul, Jazz"${add_attribute("value", $identity.genre, 0)}></div> <div><label class="label-dark" for="location" data-svelte-h="svelte-fcbx5i">Location</label> <input id="location" class="input-dark" type="text" placeholder="e.g. Nairobi, KE"${add_attribute("value", $identity.location, 0)}></div></div> <div><label class="label-dark" for="description" data-svelte-h="svelte-1krtgzi">Description</label> <textarea id="description" class="input-dark resize-none" rows="4" placeholder="A short note about this work…">${escape($identity.description || "")}</textarea></div></div>`;
});
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let manifestJSON;
  let $assets, $$unsubscribe_assets;
  let $rights, $$unsubscribe_rights;
  let $edition, $$unsubscribe_edition;
  let $identity, $$unsubscribe_identity;
  let $manifest, $$unsubscribe_manifest;
  $$unsubscribe_assets = subscribe(assets, (value) => $assets = value);
  $$unsubscribe_rights = subscribe(rights, (value) => $rights = value);
  $$unsubscribe_edition = subscribe(edition, (value) => $edition = value);
  $$unsubscribe_identity = subscribe(identity, (value) => $identity = value);
  $$unsubscribe_manifest = subscribe(manifest, (value) => $manifest = value);
  const steps = [
    { id: 1, label: "Identity", icon: "◈" },
    { id: 2, label: "Assets", icon: "◉" },
    { id: 3, label: "Edition", icon: "⬡" },
    { id: 4, label: "Rights", icon: "◎" },
    { id: 5, label: "Forge", icon: "⬟" }
  ];
  let currentStep = 1;
  manifestJSON = JSON.stringify($manifest, null, 2);
  buildExperienceHTML({
    identity: $identity,
    edition: $edition,
    rights: $rights,
    audioName: $assets.audioName,
    coverBase64: "",
    coverMime: ""
  });
  $$unsubscribe_assets();
  $$unsubscribe_rights();
  $$unsubscribe_edition();
  $$unsubscribe_identity();
  $$unsubscribe_manifest();
  return `<div class="flex min-h-[calc(100vh-56px)]"> <aside class="w-52 shrink-0 border-r hidden lg:flex flex-col pt-8 pb-6 px-4" style="background: rgba(5,5,5,0.6); border-color: var(--border-dim);"><p class="t-caption mb-6 px-2" data-svelte-h="svelte-ogeq8q">Package Builder</p> <nav class="space-y-1 flex-1">${each(steps, (step) => {
    return `<button type="button" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 text-left"${add_attribute(
      "style",
      currentStep === step.id ? "background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.25);" : "color: var(--ink-tertiary); border: 1px solid transparent;",
      0
    )}><span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"${add_attribute(
      "style",
      currentStep === step.id ? "background: var(--gradient-spectral); color: #fff;" : currentStep > step.id ? "background: rgba(123,92,240,0.2); color: #7B5CF0;" : "background: rgba(255,255,255,0.06); color: var(--ink-muted);",
      0
    )}>${escape(currentStep > step.id ? "✓" : step.id)}</span> ${escape(step.label)} </button>`;
  })}</nav>  <div class="px-2 mt-4"><div class="flex justify-between text-xs font-mono mb-2" style="color: var(--ink-muted);"><span data-svelte-h="svelte-16oy1pd">Progress</span> <span>${escape(Math.round((currentStep - 1) / 4 * 100))}%</span></div> <div class="h-0.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.06);"><div class="h-full rounded-full transition-all duration-500" style="${"width: " + escape(Math.round((currentStep - 1) / 4 * 100), true) + "%; background: var(--gradient-spectral);"}"></div></div></div></aside>  <div class="flex-1 min-w-0 flex flex-col"> <div class="flex border-b lg:hidden" style="border-color: var(--border-dim); background: rgba(5,5,5,0.6);">${each(steps, (step) => {
    return `<button type="button" class="flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2"${add_attribute(
      "style",
      currentStep === step.id ? "border-color: #7B5CF0; color: #fff;" : "border-color: transparent; color: var(--ink-muted);",
      0
    )}>${escape(step.label)}</button>`;
  })}</div> <div class="flex-1 px-8 py-8 max-w-xl">${`${validate_component(StepIdentity, "StepIdentity").$$render($$result, {}, {}, {})}`}</div>  <div class="px-8 py-5 border-t flex justify-between items-center" style="border-color: var(--border-dim);"><button class="btn-ghost" ${"disabled"}${add_attribute(
    "style",
    "opacity: 0.3; cursor: not-allowed;",
    0
  )}>← Back</button> ${`<button class="btn-spectral" data-svelte-h="svelte-1jca4vy">Continue →</button>`}</div></div>  <div class="w-80 shrink-0 border-l hidden lg:flex flex-col" style="border-color: var(--border-dim); background: rgba(5,5,5,0.4);"><div class="flex border-b" style="border-color: var(--border-dim);"><button class="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-b-2 -mb-px"${add_attribute(
    "style",
    "border-color: #7B5CF0; color: #fff;",
    0
  )}>manifest.json</button> <button class="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-b-2 -mb-px"${add_attribute(
    "style",
    "border-color: transparent; color: var(--ink-muted);",
    0
  )}>experience</button></div> <div class="flex-1 overflow-hidden">${`<div class="p-4 overflow-auto h-full" style="background: #030303;"><pre class="font-mono text-xs leading-relaxed whitespace-pre-wrap" style="color: rgba(139,92,246,0.9);">${escape(manifestJSON)}</pre></div>`}</div></div></div>`;
});
export {
  Page as default
};
