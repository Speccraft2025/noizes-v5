

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/exchange/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.CRWCIW-f.js","_app/immutable/chunks/CaMAU6Dq.js","_app/immutable/chunks/CRVjnDgM.js","_app/immutable/chunks/D6YF6ztN.js"];
export const stylesheets = [];
export const fonts = [];
