import { loadExchangePage } from '$lib/server/exchange.js';

export async function load(event) {
  return loadExchangePage(event);
}
