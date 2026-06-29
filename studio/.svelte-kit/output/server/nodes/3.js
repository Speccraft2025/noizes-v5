

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/collection/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.C95wqHnc.js","_app/immutable/chunks/CaMAU6Dq.js","_app/immutable/chunks/CRVjnDgM.js","_app/immutable/chunks/D6YF6ztN.js"];
export const stylesheets = [];
export const fonts = [];
