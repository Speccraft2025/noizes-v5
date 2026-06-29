import { c as create_ssr_component, s as subscribe, v as validate_component, b as each, d as add_attribute, e as escape } from "../../chunks/ssr.js";
import { p as page } from "../../chunks/stores.js";
const WaveCanvas = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `${`<canvas class="fixed inset-0 w-full h-full pointer-events-none" style="z-index: 0;"></canvas>`}`;
});
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $page, $$unsubscribe_page;
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  const navItems = [
    {
      label: "Studio",
      href: "/studio",
      icon: "◈"
    },
    {
      label: "Exchange",
      href: "/exchange",
      icon: "⬡"
    },
    {
      label: "Collection",
      href: "/collection",
      icon: "◉"
    },
    {
      label: "Validator",
      href: "/validator",
      icon: "◎"
    }
  ];
  $$unsubscribe_page();
  return `<div class="min-h-screen flex flex-col relative" style="background: var(--bg-deep);">${validate_component(WaveCanvas, "WaveCanvas").$$render($$result, {}, {}, {})}  <header class="sticky top-0 z-50 border-b" style="background: rgba(3,3,3,0.85); backdrop-filter: blur(20px); border-color: var(--border-dim);"><div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-14"><a href="/studio" class="flex items-center gap-2" data-svelte-h="svelte-gl78rk"><span class="font-black text-lg tracking-tight text-white">NOIZES</span> <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background: var(--spectral-violet-glow); color: var(--spectral-violet); border: 1px solid rgba(123,92,240,0.3);">v5</span></a> <nav class="flex items-center gap-1">${each(navItems, (item) => {
    return `<a${add_attribute("href", item.href, 0)} class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"${add_attribute(
      "style",
      $page.url.pathname.startsWith(item.href) ? "background: rgba(123,92,240,0.15); color: #fff; border: 1px solid rgba(123,92,240,0.3);" : "color: var(--ink-tertiary); border: 1px solid transparent;",
      0
    )}><span class="text-xs opacity-60">${escape(item.icon)}</span> ${escape(item.label)} </a>`;
  })}</nav> <button class="btn-spectral py-2 px-5 text-sm" data-svelte-h="svelte-5r2sxq">Connect</button></div></header> <main class="flex-1 relative z-10">${slots.default ? slots.default({}) : ``}</main></div>`;
});
export {
  Layout as default
};
