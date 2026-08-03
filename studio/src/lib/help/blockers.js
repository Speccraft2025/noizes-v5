/**
 * Turn "export is disabled" into "fix this, on that step".
 *
 * Studio already refuses to compile a release that would produce a broken
 * object. What it did not do is say which of the eight steps the offending
 * field lives on, so a creator could stare at a greyed-out Export button with
 * no route back to the cause.
 *
 * This module reads the *same* checks that gate export — validateReleaseProject()
 * and editionErrors() — and resolves each one to a step. It deliberately owns no
 * validation rules of its own: if it invented a rule, the helper and the
 * compiler could disagree, and the helper would be lying.
 */

import { STEP_IDS, STEP_HELP } from './content.js';

/**
 * Validation issues carry a `path` like `tracks[0].track_id`. Matching on that
 * is far more durable than matching on the human-readable message, which is
 * free to be reworded at any time.
 */
const PATH_ROUTES = [
  [/^release\./, STEP_IDS.IDENTITY],
  [/^tracks\[\d+\]\.artwork_ref/, STEP_IDS.ASSETS],   // lives on a track, fixed in Assets
  [/^tracks\[/, STEP_IDS.TRACKLIST],
  [/^audio_versions\[/, STEP_IDS.ASSETS],
  [/^audio_assets\[/, STEP_IDS.ASSETS],
  [/^track_assets\[/, STEP_IDS.ASSETS],
  [/^release_assets\[/, STEP_IDS.ASSETS],
  [/^lyrics\[/, STEP_IDS.LYRICS],
  [/^extras\./, STEP_IDS.EXTRAS],
  [/^(guide|journey)\./, STEP_IDS.EXPERIENCE],
  [/^edition\./, STEP_IDS.EDITION],
  [/^rights\./, STEP_IDS.PUBLISH],
];

/** Codes whose fixing step is not what the path implies. */
const CODE_ROUTES = {
  track_artwork_missing: STEP_IDS.ASSETS,
  edition_scope_invalid: STEP_IDS.EDITION,
};

/** Where a validation issue is actually fixed. Publish is the fallback. */
export function stepForIssue(issue) {
  if (!issue) return STEP_IDS.PUBLISH;
  if (issue.code && CODE_ROUTES[issue.code]) return CODE_ROUTES[issue.code];
  const path = String(issue.path ?? '');
  for (const [pattern, step] of PATH_ROUTES) {
    if (pattern.test(path)) return step;
  }
  return STEP_IDS.PUBLISH;
}

/**
 * Preconditions the Studio page enforces directly on the Export button, which
 * never reach validateReleaseProject() and so would otherwise be invisible.
 * Kept in step order so the returned list reads as a route through the Studio.
 */
function gatePreconditions({ identity, hasMainCover }) {
  const found = [];
  if (!String(identity?.title ?? '').trim()) {
    found.push({ code: 'gate_title_missing', step: STEP_IDS.IDENTITY, message: 'Release title is required.' });
  }
  if (!identity?.year) {
    found.push({ code: 'gate_year_missing', step: STEP_IDS.IDENTITY, message: 'Year is required.' });
  }
  if (!hasMainCover) {
    found.push({ code: 'gate_cover_missing', step: STEP_IDS.ASSETS, message: 'A main cover image is required.' });
  }
  return found;
}

/**
 * Everything standing between the creator and a compiled package.
 *
 * @param {object} input
 * @param {{errors: Array, warnings: Array}} input.validation  result of validateReleaseProject()
 * @param {string[]} input.editionErrors                       result of editionErrors()
 * @param {object} input.identity                              the identity store value
 * @param {boolean} input.hasMainCover                         a main_cover asset with a file exists
 * @returns {{blockers: Array, warnings: Array, byStep: Map<number, Array>, ready: boolean}}
 */
export function resolveBlockers({ validation, editionErrors = [], identity = {}, hasMainCover = false } = {}) {
  const blockers = [];

  for (const item of gatePreconditions({ identity, hasMainCover })) {
    blockers.push(decorate(item.message, item.step, item.code));
  }

  // editionErrors() returns plain strings and always concerns the Edition step.
  for (const message of editionErrors) {
    blockers.push(decorate(message, STEP_IDS.EDITION, 'edition_incomplete'));
  }

  for (const issue of validation?.errors ?? []) {
    blockers.push(decorate(issue.message, stepForIssue(issue), issue.code, issue.path));
  }

  const warnings = (validation?.warnings ?? []).map((issue) =>
    decorate(issue.message, stepForIssue(issue), issue.code, issue.path));

  // Deduplicate: the gate preconditions and the validator can both object to a
  // missing title, and telling someone twice is worse than telling them once.
  const seen = new Set();
  const unique = blockers.filter((item) => {
    const key = `${item.step}::${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.step - b.step);

  const byStep = new Map();
  for (const item of unique) {
    if (!byStep.has(item.step)) byStep.set(item.step, []);
    byStep.get(item.step).push(item);
  }

  return { blockers: unique, warnings, byStep, ready: unique.length === 0 };
}

function decorate(message, step, code, path) {
  return {
    message,
    step,
    stepLabel: STEP_HELP[step]?.label ?? 'Publish',
    code: code ?? '',
    path: path ?? '',
  };
}

/** One line summarising where the creator stands. */
export function blockerSummary({ blockers, ready }) {
  if (ready) return 'Ready to compile.';
  const steps = new Set(blockers.map((item) => item.step));
  const count = blockers.length;
  const where = steps.size === 1
    ? `on ${STEP_HELP[[...steps][0]]?.label ?? 'one step'}`
    : `across ${steps.size} steps`;
  return `${count} item${count === 1 ? '' : 's'} to resolve ${where}.`;
}
