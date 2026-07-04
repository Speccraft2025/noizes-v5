import { writable, derived } from 'svelte/store';

export const identity = writable({
  artist: '',
  title: '',
  release_id: '',
  year: new Date().getFullYear().toString(),
  genre: '',
  location: '',
  description: ''
});

export const assets = writable({
  audioFile: null,
  coverFile: null,
  audioName: '',
  coverName: '',
  // lyrics: array of {t: ms, text: string} — set by StepLyrics
  lyrics: []
});

// Which template / theme the package uses
export const template = writable('ultra'); // 'ultra' | 'codex' | 'transmission' | 'monument'

export const edition = writable({
  edition_name: '',
  edition_type: 'Open Edition',
  edition_size: '',
  price: '',
  currency: 'KES',
  transferable: true
});

export const rights = writable({
  copyright: '',
  license: 'All Rights Reserved',
  producer: '',
  credits: ''
});

export const EDITION_TYPES = [
  'First Edition',
  'Open Edition',
  'Founder Edition',
  'Collector Edition',
  'Archive Edition',
  'Artist Proof'
];

export const LIMITED_TYPES = ['First Edition', 'Founder Edition', 'Collector Edition', 'Archive Edition', 'Artist Proof'];

export const CURRENCIES = ['KES', 'USD', 'EUR'];

export const LICENSES = [
  'All Rights Reserved',
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC BY-NC 4.0',
  'CC BY-NC-SA 4.0',
  'CC0 1.0 Universal'
];

export const manifest = derived(
  [identity, edition, rights],
  ([$identity, $edition, $rights]) => ({
    noizes_version: '1.0.0',
    package_type: 'music',
    artist: $identity.artist,
    title: $identity.title,
    release_id: $identity.release_id || `nz-${Date.now()}`,
    year: $identity.year,
    genre: $identity.genre,
    location: $identity.location,
    description: $identity.description,
    edition_type: $edition.edition_type,
    edition_name: $edition.edition_name,
    edition_size: $edition.edition_size || 'unlimited',
    price: $edition.price,
    currency: $edition.currency,
    copyright: $rights.copyright,
    license: $rights.license,
    created_at: new Date().toISOString()
  })
);
