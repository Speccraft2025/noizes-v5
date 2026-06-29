import { c as create_ssr_component, d as add_attribute } from "../../../chunks/ssr.js";
import "jszip";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<div class="max-w-3xl mx-auto px-6 py-8"><div class="mb-10" data-svelte-h="svelte-6ktutq"><p class="t-caption mb-2">Inspector</p> <h1 class="t-monumental-small text-white mb-2">Validator</h1> <p class="text-base" style="color: var(--ink-muted);">Drop a .nz package to inspect and validate its structure.</p></div>  <label class="glass rounded-2xl flex flex-col items-center justify-center py-20 cursor-pointer mb-8 transition-all duration-300"${add_attribute(
    "style",
    "border-style: dashed;",
    0
  )}><div class="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-300"${add_attribute(
    "style",
    "background: rgba(123,92,240,0.12); border: 1px solid rgba(123,92,240,0.25);",
    0
  )}><span class="text-2xl" style="color: #7B5CF0;" data-svelte-h="svelte-fuo1xo">⬡</span></div> <p class="t-caption mb-2" data-svelte-h="svelte-19obj6s">.nz · .zip</p> <p class="text-sm" style="color: var(--ink-muted);" data-svelte-h="svelte-dcty8q">Drop package here or <span class="text-white underline">browse</span></p> <input type="file" class="hidden" accept=".nz,.zip"></label> ${``}</div>`;
});
export {
  Page as default
};
