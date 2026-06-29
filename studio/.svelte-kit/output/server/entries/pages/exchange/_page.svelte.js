import { c as create_ssr_component, b as each, e as escape } from "../../../chunks/ssr.js";
function fmt(price, currency) {
  if (currency === "KES") return `KES ${price.toLocaleString()}`;
  if (currency === "USD") return `$${price}`;
  if (currency === "EUR") return `€${price}`;
  return `${currency} ${price}`;
}
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  const featured = [
    {
      id: 1,
      artist: "Msafiri Zawose",
      title: "Kibuyu",
      genre: "Gogo",
      year: "2024",
      location: "Dodoma, TZ",
      edition_type: "First Edition",
      edition_size: 50,
      price: 2500,
      currency: "KES",
      available: 12,
      color: "#7B5CF0"
    },
    {
      id: 2,
      artist: "KMRU",
      title: "Peel",
      genre: "Ambient",
      year: "2022",
      location: "Berlin, DE",
      edition_type: "Archive Edition",
      edition_size: 100,
      price: 15,
      currency: "EUR",
      available: 33,
      color: "#4B6BF0"
    },
    {
      id: 3,
      artist: "Kasiva Mutua",
      title: "Ngoma Ya Moyo",
      genre: "Afro-Jazz",
      year: "2023",
      location: "Nairobi, KE",
      edition_type: "Collector Edition",
      edition_size: 20,
      price: 5e3,
      currency: "KES",
      available: 7,
      color: "#F04BD8"
    }
  ];
  const feed = [
    {
      id: 1,
      artist: "Msafiri Zawose",
      title: "Kibuyu",
      genre: "Gogo",
      year: "2024",
      location: "Dodoma, TZ",
      edition_type: "First Edition",
      edition_size: 50,
      price: 2500,
      currency: "KES",
      available: 12,
      votes: 842,
      comments: 34
    },
    {
      id: 2,
      artist: "Blinky Bill",
      title: "Hali Halisi",
      genre: "Afro-Soul",
      year: "2024",
      location: "Nairobi, KE",
      edition_type: "Open Edition",
      edition_size: null,
      price: 500,
      currency: "KES",
      available: null,
      votes: 631,
      comments: 22
    },
    {
      id: 3,
      artist: "Kasiva Mutua",
      title: "Ngoma Ya Moyo",
      genre: "Afro-Jazz",
      year: "2023",
      location: "Nairobi, KE",
      edition_type: "Collector Edition",
      edition_size: 20,
      price: 5e3,
      currency: "KES",
      available: 7,
      votes: 519,
      comments: 18
    },
    {
      id: 4,
      artist: "KMRU",
      title: "Peel",
      genre: "Ambient",
      year: "2022",
      location: "Berlin, DE",
      edition_type: "Archive Edition",
      edition_size: 100,
      price: 15,
      currency: "EUR",
      available: 33,
      votes: 410,
      comments: 11
    },
    {
      id: 5,
      artist: "Chidi Benz",
      title: "Niambie",
      genre: "Bongo Flava",
      year: "2024",
      location: "Dar es Salaam, TZ",
      edition_type: "Artist Proof",
      edition_size: 10,
      price: 9e3,
      currency: "KES",
      available: 2,
      votes: 389,
      comments: 9
    },
    {
      id: 6,
      artist: "Sho Madjozi",
      title: "Dumi Hi Phone",
      genre: "Tsonga-Pop",
      year: "2023",
      location: "Johannesburg, ZA",
      edition_type: "Founder Edition",
      edition_size: 30,
      price: 80,
      currency: "USD",
      available: 9,
      votes: 298,
      comments: 15
    }
  ];
  const colors = ["#7B5CF0", "#4B6BF0", "#F04BD8", "#7B5CF0", "#4B6BF0", "#F04BD8"];
  return `<div class="max-w-7xl mx-auto px-6 py-8"> <div class="mb-10" data-svelte-h="svelte-1a9yr1o"><p class="t-caption mb-2">Discover</p> <h1 class="t-monumental-small text-white mb-2">Exchange</h1> <p class="text-base" style="color: var(--ink-muted);">Browse and acquire cultural objects from artists worldwide.</p></div>  <div class="mb-10"><p class="t-caption mb-4" data-svelte-h="svelte-mb1hp4">Top Experiences</p> <div class="grid grid-cols-1 md:grid-cols-3 gap-4">${each(featured, (ed) => {
    return `<div class="glass rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:border-opacity-50" style="${"border-color: " + escape(ed.color, true) + "30;"}"> <div class="w-full aspect-square relative flex items-end p-5" style="${"background: radial-gradient(ellipse at top, " + escape(ed.color, true) + "30 0%, transparent 70%), var(--charcoal);"}"><div class="absolute inset-0 flex items-center justify-center"><div class="w-20 h-20 rounded-full opacity-20" style="${"background: " + escape(ed.color, true) + "; filter: blur(30px);"}"></div> <span class="text-6xl font-black opacity-10 absolute" style="${"color: " + escape(ed.color, true) + ";"}">${escape(ed.artist[0])}</span></div> <div class="relative z-10"><p class="text-xs font-bold uppercase tracking-widest mb-1" style="${"color: " + escape(ed.color, true) + ";"}">${escape(ed.artist)}</p> <h3 class="text-xl font-black text-white leading-tight">${escape(ed.title)}</h3> </div></div> <div class="p-4 flex items-center justify-between"><div><p class="text-xs font-semibold" style="color: var(--ink-muted);">${escape(ed.edition_type)} · ${escape(ed.available ?? "∞")} left</p></div> <div class="flex items-center gap-3"><span class="text-sm font-black text-white">${escape(fmt(ed.price, ed.currency))}</span> <button class="btn-spectral py-1.5 px-4 text-xs rounded-full" data-svelte-h="svelte-1nxibaj">Acquire</button> </div></div> </div>`;
  })}</div></div> <div class="glow-line mb-8"></div>  <div><p class="t-caption mb-4" data-svelte-h="svelte-tgkv49">All Releases</p> <div class="space-y-2">${each(feed, (ed, i) => {
    return `<div class="glass rounded-xl px-5 py-4 flex items-center gap-5 group cursor-pointer transition-all duration-200 hover:border-opacity-50" style="border-color: rgba(255,255,255,0.06);"> <div class="text-center w-10 shrink-0"><button class="text-xs font-black transition-colors" style="color: var(--ink-muted);" data-svelte-h="svelte-1vwfppd">▲</button> <p class="text-sm font-black text-white">${escape(ed.votes)}</p></div>  <div class="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center text-lg font-black" style="${"background: radial-gradient(ellipse, " + escape(colors[i % 6], true) + "25, transparent); border: 1px solid " + escape(colors[i % 6], true) + "30; color: " + escape(colors[i % 6], true) + ";"}">${escape(ed.artist[0])}</div>  <div class="flex-1 min-w-0"><div class="flex items-baseline gap-2 mb-0.5"><span class="text-xs font-bold uppercase tracking-widest" style="${"color: " + escape(colors[i % 6], true) + ";"}">${escape(ed.artist)}</span> <span style="color: var(--border-dim);" data-svelte-h="svelte-d2ybe0">·</span> <span class="text-xs" style="color: var(--ink-muted);">${escape(ed.genre)} · ${escape(ed.year)} · ${escape(ed.location)}</span></div> <h3 class="text-base font-black text-white leading-tight group-hover:opacity-80 transition-opacity">${escape(ed.title)}</h3> <div class="flex gap-3 mt-1"><span class="text-xs px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.05); color: var(--ink-muted);">${escape(ed.edition_type)}</span> ${ed.available !== null ? `<span class="text-xs" style="color: var(--ink-muted);">${escape(ed.available)} of ${escape(ed.edition_size)} left</span>` : `<span class="text-xs" style="color: var(--ink-muted);" data-svelte-h="svelte-un046a">Open edition</span>`} <span class="text-xs" style="color: var(--ink-muted);">💬 ${escape(ed.comments)}</span> </div></div>  <div class="text-right shrink-0"><p class="text-base font-black text-white">${escape(fmt(ed.price, ed.currency))}</p> <button class="btn-ghost mt-2 py-1.5 px-4 text-xs rounded-full" data-svelte-h="svelte-yy61pu">Acquire</button></div> </div>`;
  })}</div></div></div>`;
});
export {
  Page as default
};
