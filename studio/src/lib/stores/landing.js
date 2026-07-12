import { writable } from 'svelte/store';

// Flipped when the visitor clicks ENTER on the landing gate — the orb scene
// listens to this to swell the orb in, in sync with the hero text reveal.
export const introDone = writable(false);
