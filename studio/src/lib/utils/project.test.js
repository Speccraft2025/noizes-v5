import { describe, expect, it } from 'vitest';
import { CANONICAL_TEMPLATE, editionErrors, normalizeEdition, normalizeTemplate } from './project.js';

describe('canonical project migration', () => {
  it('normalizes every legacy theme to ultra-v2', () => {
    for (const id of ['ultra', 'codex', 'transmission', 'monument', undefined, 'future-unknown']) {
      expect(normalizeTemplate(id)).toBe(CANONICAL_TEMPLATE);
    }
  });

  it('retains a legacy public edition label but migrates to one fixed edition', () => {
    expect(normalizeEdition({ edition_type: 'Collector Edition', edition_size: 25, price: 1000 }))
      .toMatchObject({ edition_type: 'fixed', edition_name: 'Collector Edition', edition_size: '25', price: 1000 });
  });

  it('requires a name, positive price, and positive whole-number supply', () => {
    expect(editionErrors({ edition_name: '', price: 0, edition_size: 'unlimited' })).toHaveLength(3);
    expect(editionErrors({ edition_name: 'First Pressing', price: 2500, edition_size: '100' })).toEqual([]);
  });
});
