import * as universal from '../entries/pages/_page.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+page.js";
export const imports = ["_app/immutable/nodes/2.itJ-DqPV.js","_app/immutable/chunks/CaMAU6Dq.js","_app/immutable/chunks/CRVjnDgM.js","_app/immutable/chunks/JGdoEVDK.js","_app/immutable/chunks/BQI_PtJo.js"];
export const stylesheets = [];
export const fonts = [];
