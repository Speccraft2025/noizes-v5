export const CANONICAL_TEMPLATE = 'ultra-v2';
export const TRANSCENDENCE_TEMPLATE = 'transcendence-v1';
export const TRANSCENDENCE_V2_TEMPLATE = 'transcendence-v2';
export const TRANSCENDENCE_V2_EXPERIMENTAL = TRANSCENDENCE_V2_TEMPLATE;
export const TRANSCENDENCE_V3_TEMPLATE = 'transcendence-v3';
export const STANDARD_EDITION_TYPE = 'fixed';

/** The experience systems a creator may choose between. ULTRA leads: it is the default. */
export const EXPERIENCE_SYSTEMS = [CANONICAL_TEMPLATE, TRANSCENDENCE_TEMPLATE, TRANSCENDENCE_V2_TEMPLATE, TRANSCENDENCE_V3_TEMPLATE];

// Values from templates that no longer exist. They collapse to ULTRA rather than
// erroring, so an old draft still opens.
const LEGACY_TEMPLATES = new Set(['ultra', 'codex', 'transmission', 'monument', 'classic', 'immersive', 'hub']);

export function normalizeTemplate(value) {
  if (EXPERIENCE_SYSTEMS.includes(value)) return value;
  if (LEGACY_TEMPLATES.has(value) || !value) return CANONICAL_TEMPLATE;
  return CANONICAL_TEMPLATE;
}

export const isTranscendence = (value) => normalizeTemplate(value) === TRANSCENDENCE_TEMPLATE;
export const isTranscendenceV2Experimental = (value) => value === TRANSCENDENCE_V2_TEMPLATE;
export const isTranscendenceV3 = (value) => value === TRANSCENDENCE_V3_TEMPLATE;

export function normalizeEdition(value = {}) {
  const legacyName = value.edition_name || (value.edition_type && value.edition_type !== 'Open Edition' ? value.edition_type : 'First Edition');
  const parsedSupply = Number.parseInt(value.edition_size, 10);
  return {
    ...value,
    edition_type: STANDARD_EDITION_TYPE,
    edition_name: legacyName,
    edition_size: Number.isInteger(parsedSupply) && parsedSupply > 0 ? String(parsedSupply) : '',
  };
}

export function editionErrors(value) {
  const errors = [];
  if (!String(value.edition_name || '').trim()) errors.push('Edition name is required.');
  if (!(Number(value.price) > 0)) errors.push('Price must be greater than zero.');
  if (!Number.isInteger(Number(value.edition_size)) || Number(value.edition_size) <= 0) {
    errors.push('Fixed supply must be a positive whole number.');
  }
  return errors;
}
