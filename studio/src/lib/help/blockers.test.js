import { describe, expect, it } from 'vitest';
import { blockerSummary, resolveBlockers, stepForIssue } from './blockers.js';
import { PREFLIGHT, STEP_HELP, STEP_IDS, fieldHelp, stepHelp } from './content.js';
import { validateReleaseProject, createReleaseProject } from '../domain/release.js';
import { editionErrors } from '../utils/project.js';

const complete = { title: 'Nightjar', year: 2026 };

describe('stepForIssue', () => {
  it('routes each validation path to the step that actually fixes it', () => {
    const cases = [
      [{ path: 'release.title' }, STEP_IDS.IDENTITY],
      [{ path: 'tracks[0].track_id' }, STEP_IDS.TRACKLIST],
      [{ path: 'audio_assets[2].asset_id' }, STEP_IDS.ASSETS],
      [{ path: 'track_assets[0].track_id' }, STEP_IDS.ASSETS],
      [{ path: 'lyrics[0].language' }, STEP_IDS.LYRICS],
      [{ path: 'extras.story' }, STEP_IDS.EXTRAS],
      [{ path: 'guide.nodes' }, STEP_IDS.EXPERIENCE],
      [{ path: 'edition.applies_to' }, STEP_IDS.EDITION],
      [{ path: 'rights.release_rights.credit_records[0].credit_id' }, STEP_IDS.PUBLISH],
    ];
    for (const [issue, expected] of cases) {
      expect(stepForIssue(issue), issue.path).toBe(expected);
    }
  });

  it('sends track artwork to Assets even though its path is on a track', () => {
    // The field lives at tracks[N].artwork_ref but the fix is uploading or
    // re-assigning an image, which only happens in Assets.
    const issue = { code: 'track_artwork_missing', path: 'tracks[3].artwork_ref' };
    expect(stepForIssue(issue)).toBe(STEP_IDS.ASSETS);
    expect(stepForIssue({ path: 'tracks[3].artwork_ref' })).toBe(STEP_IDS.ASSETS);
  });

  it('falls back to Publish rather than guessing on an unknown path', () => {
    expect(stepForIssue({ path: 'something.new.we.added' })).toBe(STEP_IDS.PUBLISH);
    expect(stepForIssue({})).toBe(STEP_IDS.PUBLISH);
    expect(stepForIssue(null)).toBe(STEP_IDS.PUBLISH);
  });
});

describe('resolveBlockers', () => {
  it('surfaces the export-gate preconditions the validator never sees', () => {
    // title, year and cover are checked on the Export button itself, not by
    // validateReleaseProject, so without this they were invisible.
    const { blockers } = resolveBlockers({
      validation: { errors: [], warnings: [] },
      identity: { title: '', year: null },
      hasMainCover: false,
    });
    const messages = blockers.map((b) => b.message);
    expect(messages).toContain('Release title is required.');
    expect(messages).toContain('Year is required.');
    expect(messages).toContain('A main cover image is required.');
    expect(blockers.find((b) => b.message.includes('cover')).step).toBe(STEP_IDS.ASSETS);
    expect(blockers.find((b) => b.message.includes('title')).step).toBe(STEP_IDS.IDENTITY);
  });

  it('reports ready when nothing is outstanding', () => {
    const result = resolveBlockers({
      validation: { errors: [], warnings: [] },
      editionErrors: [],
      identity: complete,
      hasMainCover: true,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(blockerSummary(result)).toBe('Ready to compile.');
  });

  it('attributes every edition error to the Edition step', () => {
    const { blockers } = resolveBlockers({
      validation: { errors: [], warnings: [] },
      editionErrors: ['Edition name is required.', 'Price must be greater than zero.'],
      identity: complete,
      hasMainCover: true,
    });
    expect(blockers).toHaveLength(2);
    for (const blocker of blockers) {
      expect(blocker.step).toBe(STEP_IDS.EDITION);
      expect(blocker.stepLabel).toBe('Edition');
    }
  });

  it('does not tell the creator the same thing twice', () => {
    // The gate and the validator both object to a missing title.
    const { blockers } = resolveBlockers({
      validation: {
        errors: [{ code: 'release_title_missing', path: 'release.title', message: 'Release title is required.' }],
        warnings: [],
      },
      identity: { title: '', year: 2026 },
      hasMainCover: true,
    });
    const titleBlockers = blockers.filter((b) => b.message === 'Release title is required.');
    expect(titleBlockers).toHaveLength(1);
  });

  it('orders blockers by step so the list reads as a route through the Studio', () => {
    const { blockers } = resolveBlockers({
      validation: {
        errors: [
          { code: 'edition_scope_invalid', path: 'edition.applies_to', message: 'Edition scope.' },
          { code: 'track_id_duplicate', path: 'tracks[1].track_id', message: 'Track IDs must be unique.' },
        ],
        warnings: [],
      },
      identity: { title: '', year: 2026 },
      hasMainCover: true,
    });
    const steps = blockers.map((b) => b.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(steps[0]).toBe(STEP_IDS.IDENTITY);
  });

  it('groups blockers by step for the step badges', () => {
    const { byStep } = resolveBlockers({
      validation: { errors: [], warnings: [] },
      editionErrors: ['Edition name is required.', 'Price must be greater than zero.'],
      identity: complete,
      hasMainCover: true,
    });
    expect(byStep.get(STEP_IDS.EDITION)).toHaveLength(2);
    expect(byStep.has(STEP_IDS.IDENTITY)).toBe(false);
  });

  it('keeps warnings separate from blockers', () => {
    const result = resolveBlockers({
      validation: {
        errors: [],
        warnings: [{ code: 'w', path: 'release.genre', message: 'Consider adding a genre.' }],
      },
      identity: complete,
      hasMainCover: true,
    });
    expect(result.ready).toBe(true);           // warnings must never block
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].step).toBe(STEP_IDS.IDENTITY);
  });

  it('survives being called with nothing', () => {
    const result = resolveBlockers();
    expect(result.ready).toBe(false);          // an empty draft is not shippable
    expect(Array.isArray(result.blockers)).toBe(true);
  });

  it('summarises one step and several steps differently', () => {
    const one = resolveBlockers({
      validation: { errors: [], warnings: [] },
      editionErrors: ['Edition name is required.'],
      identity: complete, hasMainCover: true,
    });
    expect(blockerSummary(one)).toBe('1 item to resolve on Edition.');

    const many = resolveBlockers({
      validation: { errors: [], warnings: [] },
      editionErrors: ['Edition name is required.'],
      identity: { title: '', year: 2026 }, hasMainCover: true,
    });
    expect(blockerSummary(many)).toMatch(/^2 items to resolve across 2 steps\.$/);
  });
});

describe('resolveBlockers against the real validator', () => {
  it('routes every error a blank project produces to a real step', () => {
    // No hand-written fixtures: run the actual validator and prove nothing
    // falls through unrouted or lands on a step that does not exist.
    const project = createReleaseProject();
    const validation = validateReleaseProject(project);
    const { blockers } = resolveBlockers({
      validation,
      editionErrors: editionErrors({}),
      identity: {},
      hasMainCover: false,
    });
    expect(blockers.length).toBeGreaterThan(0);
    for (const blocker of blockers) {
      expect(Object.values(STEP_IDS)).toContain(blocker.step);
      expect(blocker.stepLabel).toBeTruthy();
      expect(blocker.message).toBeTruthy();
    }
  });
});

describe('help content', () => {
  it('covers all eight steps with the fields the compiler enforces', () => {
    expect(Object.keys(STEP_HELP)).toHaveLength(8);
    for (const id of Object.values(STEP_IDS)) {
      const help = stepHelp(id);
      expect(help, `step ${id}`).toBeTruthy();
      expect(help.label).toBeTruthy();
      expect(help.settles).toBeTruthy();
      expect(help.advice.title).toBeTruthy();
      expect(help.advice.body.length).toBeGreaterThan(40);
      expect(Array.isArray(help.required)).toBe(true);
    }
  });

  it('lists the three required Edition fields, matching editionErrors()', () => {
    // If someone adds a rule to editionErrors() this should be updated with it.
    expect(editionErrors({})).toHaveLength(3);
    expect(stepHelp(STEP_IDS.EDITION).required).toHaveLength(3);
  });

  it('returns an empty string for an unknown field rather than undefined', () => {
    expect(fieldHelp('nope')).toBe('');
    expect(fieldHelp('edition_size')).toMatch(/positive whole number/);
  });

  it('has a preflight checklist', () => {
    expect(PREFLIGHT.length).toBeGreaterThanOrEqual(5);
    for (const item of PREFLIGHT) expect(typeof item).toBe('string');
  });
});
