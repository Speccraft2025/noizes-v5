import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIELD_HELP } from './content.js';

/**
 * The tooltips are wired by string id, which the compiler cannot check. A typo
 * in `<HelpTip field="tittle" />` would render nothing at all — HelpTip hides
 * itself when the body is empty, so the failure is completely silent and looks
 * exactly like "we forgot that one". These tests are the check the type system
 * cannot do for us.
 */

const COMPONENTS = fileURLToPath(new URL('../components', import.meta.url));

const sources = readdirSync(COMPONENTS)
  .filter((name) => name.endsWith('.svelte'))
  .map((name) => ({ name, text: readFileSync(`${COMPONENTS}/${name}`, 'utf8') }));

const all = sources.map((file) => file.text).join('\n');

describe('tooltip wiring', () => {
  it('never references a field id that has no help text', () => {
    const missing = [];
    for (const { name, text } of sources) {
      for (const [, id] of text.matchAll(/<HelpTip[^>]*\bfield="([^"{]+)"/g)) {
        if (!FIELD_HELP[id]) missing.push(`${name} → field="${id}"`);
      }
    }
    expect(missing, 'HelpTip ids with no entry in FIELD_HELP').toEqual([]);
  });

  it('has no orphaned help text nobody shows', () => {
    // Every key must appear somewhere in the components, either as a literal
    // field="…" or inside a data array feeding field={…}.
    const orphans = Object.keys(FIELD_HELP).filter((id) => !all.includes(id));
    expect(orphans, 'FIELD_HELP entries never rendered').toEqual([]);
  });

  it('covers every step that has fields', () => {
    // A step component with inputs but no tooltips means a whole step was
    // missed, which is the failure mode a per-field check cannot see.
    const withInputs = sources.filter(
      ({ name, text }) => name.startsWith('Step') && /<input|<textarea|<select/.test(text),
    );
    const untipped = withInputs
      .filter(({ text }) => !text.includes('<HelpTip'))
      .map(({ name }) => name);

    // StepPlay is a games toggle list, not release data entry. StepExport has
    // no inputs at all, so it never reaches this list.
    expect(untipped.sort()).toEqual(['StepPlay.svelte']);
  });
});

describe('help text quality', () => {
  it('says plainly whether each field is required', () => {
    // The required ones are what a creator scans for; leaving it implicit is
    // the single most common way this kind of help fails.
    const required = [
      'release_type', 'title', 'artist', 'year',
      'main_cover', 'primary_master',
      'track_title', 'track_artist',
      'edition_name', 'edition_size', 'price',
      'credit_name', 'credit_role',
    ];
    for (const id of required) {
      // "Required." or "Required for every track." — the word leads either way.
      expect(FIELD_HELP[id], id).toMatch(/^Required\b/);
    }
  });

  it('marks the optional ones optional rather than leaving it ambiguous', () => {
    const optional = ['featured_artists', 'label', 'genre', 'story', 'track_isrc'];
    for (const id of optional) {
      expect(FIELD_HELP[id], id).toMatch(/^(Optional|Generated)/);
    }
  });

  it('stays short enough to read in a tooltip', () => {
    for (const [id, body] of Object.entries(FIELD_HELP)) {
      expect(body.length, `${id} is too long for a tooltip`).toBeLessThanOrEqual(320);
      expect(body.length, `${id} is too terse to be useful`).toBeGreaterThan(24);
      expect(body.trim(), id).toBe(body);
      expect(body, `${id} should end in a full stop`).toMatch(/[.!?]$/);
    }
  });

  it('explains the whole form, not just the required parts', () => {
    // Guards against a future field being added with no tooltip written.
    expect(Object.keys(FIELD_HELP).length).toBeGreaterThanOrEqual(60);
  });
});
