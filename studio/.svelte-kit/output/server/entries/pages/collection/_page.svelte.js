import { c as create_ssr_component, e as escape, b as each } from "../../../chunks/ssr.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  const collection = [
    {
      id: 1,
      artist: "KMRU",
      title: "Peel",
      edition_type: "Archive Edition",
      acquired: "2024-03-12",
      edition_number: 33,
      edition_size: 100,
      currency: "EUR",
      price: 15,
      genre: "Ambient",
      location: "Berlin, DE",
      year: "2022",
      color: "#4B6BF0"
    },
    {
      id: 2,
      artist: "Blinky Bill",
      title: "Hali Halisi",
      edition_type: "Open Edition",
      acquired: "2024-05-01",
      edition_number: null,
      edition_size: null,
      currency: "KES",
      price: 500,
      genre: "Afro-Soul",
      location: "Nairobi, KE",
      year: "2024",
      color: "#7B5CF0"
    }
  ];
  const events = [
    {
      date: "2024-05-01",
      work: "Blinky Bill — Hali Halisi",
      event: "purchased",
      price: "KES 500"
    },
    {
      date: "2024-03-12",
      work: "KMRU — Peel",
      event: "purchased",
      price: "EUR 15"
    }
  ];
  return `<div class="max-w-5xl mx-auto px-6 py-8"><div class="mb-10 flex items-end justify-between"><div data-svelte-h="svelte-1lugc6"><p class="t-caption mb-2">Your Library</p> <h1 class="t-monumental-small text-white">Collection</h1> <p class="text-base mt-2" style="color: var(--ink-muted);">Your owned cultural objects and provenance history.</p></div> <div class="glass rounded-xl px-5 py-3 text-center"><p class="text-2xl font-black text-white">${escape(collection.length)}</p> <p class="t-caption" data-svelte-h="svelte-1uuioog">Objects</p></div></div> ${collection.length === 0 ? `<div class="glass rounded-2xl p-16 text-center" data-svelte-h="svelte-qwbgt2"><p class="t-caption mb-3">Empty collection</p> <p class="text-base" style="color: var(--ink-muted);">Head to <a href="/exchange" class="text-white underline">Exchange</a> to acquire your first object.</p></div>` : `<div class="space-y-3 mb-10">${each(collection, (item) => {
    return `<div class="glass rounded-2xl p-5 flex gap-5 group transition-all duration-200"> <div class="w-20 h-20 shrink-0 rounded-xl flex items-center justify-center text-2xl font-black" style="${"background: radial-gradient(ellipse, " + escape(item.color, true) + "25, transparent); border: 1px solid " + escape(item.color, true) + "25; color: " + escape(item.color, true) + ";"}">${escape(item.artist[0])}</div>  <div class="flex-1 min-w-0"><p class="text-xs font-bold uppercase tracking-widest mb-0.5" style="${"color: " + escape(item.color, true) + ";"}">${escape(item.artist)}</p> <h3 class="text-xl font-black text-white mb-2">${escape(item.title)}</h3> <div class="flex gap-4 flex-wrap"><span class="text-xs" style="color: var(--ink-muted);">${escape(item.genre)} · ${escape(item.year)} · ${escape(item.location)}</span></div> <div class="flex gap-3 mt-2 flex-wrap"><span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">${escape(item.edition_type)}${escape(item.edition_number ? ` #${item.edition_number}` : "")}${escape(item.edition_size ? ` / ${item.edition_size}` : "")}</span> <span class="text-xs" style="color: var(--ink-muted);">Acquired ${escape(item.acquired)}</span> <span class="text-xs" style="color: var(--ink-muted);">${escape(item.currency)} ${escape(item.price)}</span> </div></div>  <div class="flex flex-col gap-2 shrink-0 justify-center" data-svelte-h="svelte-1pa4wo7"><button class="btn-spectral py-1.5 px-4 text-xs rounded-full">Open .nz</button> <button class="btn-ghost py-1.5 px-4 text-xs rounded-full">Transfer</button></div> </div>`;
  })}</div>  <div><p class="t-caption mb-4" data-svelte-h="svelte-18thx30">Ownership Events</p> <div class="glass rounded-xl overflow-hidden"><table class="w-full text-xs font-mono"><thead data-svelte-h="svelte-1vpb1j"><tr class="border-b" style="border-color: var(--border-dim);"><th class="text-left px-5 py-3" style="color: var(--ink-muted);">Date</th> <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Work</th> <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Event</th> <th class="text-left px-5 py-3" style="color: var(--ink-muted);">Price</th></tr></thead> <tbody>${each(events, (ev) => {
    return `<tr class="border-b last:border-0 transition-colors" style="border-color: var(--border-dim);"><td class="px-5 py-3" style="color: var(--ink-muted);">${escape(ev.date)}</td> <td class="px-5 py-3 text-white">${escape(ev.work)}</td> <td class="px-5 py-3" style="color: #7B5CF0;">${escape(ev.event)}</td> <td class="px-5 py-3 text-white">${escape(ev.price)}</td> </tr>`;
  })}</tbody></table></div></div>`}</div>`;
});
export {
  Page as default
};
