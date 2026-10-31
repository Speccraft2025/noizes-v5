import { writable, derived } from 'svelte/store';

export const STEPS = [
  {
    id: 'identity',
    number: 1,
    label: 'Identity',
    sections: [
      { id: 'release-artists', label: 'Release & artists', heading: 'Give your release an identity.', subtext: 'Start with the music and the people behind it.' },
      { id: 'label-genres-location', label: 'Label, genres & location', heading: 'Place your release in context.', subtext: 'Help listeners find music like yours.' },
      { id: 'dates-context', label: 'Dates & release context', heading: 'When does this release arrive?', subtext: 'Set the timeline and any additional context.' },
    ],
  },
  {
    id: 'assets',
    number: 2,
    label: 'Assets',
    sections: [
      { id: 'audio', label: 'Audio', heading: 'Add your audio masters.', subtext: 'Upload the primary master for each track, plus any alternates.' },
      { id: 'artwork', label: 'Artwork', heading: 'Set the visual identity.', subtext: 'Cover art and supplementary visuals for the release.' },
      { id: 'asset-review', label: 'Asset review', heading: 'Review your uploads.', subtext: 'Check that every track has its audio and nothing is missing.' },
    ],
  },
  {
    id: 'lyrics',
    number: 3,
    label: 'Lyrics',
    sections: [
      { id: 'select-track', label: 'Select track', heading: 'Choose a track to add lyrics.', subtext: 'Each track can carry its own lyrics and synchronisation.' },
      { id: 'edit-lyrics', label: 'Edit lyrics', heading: 'Write or import the words.', subtext: 'Paste plain text or import a timed lyrics file.' },
      { id: 'review-sync', label: 'Review', heading: 'Review lyrics and timing.', subtext: 'Check synchronisation status across all tracks.' },
    ],
  },
  {
    id: 'extras',
    number: 4,
    label: 'Extras',
    sections: [
      { id: 'supplementary', label: 'Supplementary', heading: 'Add what lives around the music.', subtext: 'Liner notes, artist statements and PDF booklets.' },
      { id: 'links-games', label: 'Links & games', heading: 'Online links and interactive moments.', subtext: 'Optional pathways and playable add-ons for the experience.' },
      { id: 'review-extras', label: 'Review extras', heading: 'Review included extras.', subtext: 'Everything here becomes part of the offline package.' },
    ],
  },
  {
    id: 'experience',
    number: 5,
    label: 'Experience',
    sections: [
      { id: 'select-experience', label: 'Select experience', heading: 'Choose how listeners experience this release.', subtext: 'Select and configure the immersive presentation.' },
      { id: 'customize', label: 'Customize', heading: 'Shape the experience.', subtext: 'Adjust the presentation settings for this release.' },
      { id: 'preview', label: 'Preview', heading: 'Preview your experience.', subtext: 'See the finished presentation as a listener would.' },
    ],
  },
  {
    id: 'edition',
    number: 6,
    label: 'Edition',
    sections: [
      { id: 'edition-identity', label: 'Edition identity', heading: 'Name this pressing.', subtext: 'Give the edition a title and description collectors will see.' },
      { id: 'supply-pricing', label: 'Supply & pricing', heading: 'Set supply and price.', subtext: 'Fixed supply is permanent after publication.' },
      { id: 'review-edition', label: 'Review', heading: 'Review edition settings.', subtext: 'Confirm the commercial terms for this pressing.' },
    ],
  },
  {
    id: 'rights-export',
    number: 7,
    label: 'Rights & export',
    sections: [
      { id: 'rights-credits', label: 'Rights & credits', heading: 'Declare rights and credits.', subtext: 'Record ownership, licensing and every contributor.' },
      { id: 'validation', label: 'Validation', heading: 'Package review.', subtext: 'Check every requirement before compiling.' },
      { id: 'compile-publish', label: 'Compile & publish', heading: 'Compile and publish.', subtext: 'Build the .nz package and optionally list on Exchange.' },
    ],
  },
];

export const STEP_COUNT = STEPS.length;

export const currentStepIndex = writable(0);
export const currentSectionIndex = writable(0);

export const currentStep = derived(currentStepIndex, ($i) => STEPS[Math.max(0, Math.min($i, STEPS.length - 1))]);
export const currentSection = derived(
  [currentStepIndex, currentSectionIndex],
  ([$si, $sci]) => {
    const step = STEPS[Math.max(0, Math.min($si, STEPS.length - 1))];
    return step.sections[Math.max(0, Math.min($sci, step.sections.length - 1))];
  }
);

export const sectionCompletion = writable({});

export function markSectionState(stepId, sectionId, state) {
  sectionCompletion.update((map) => ({
    ...map,
    [`${stepId}:${sectionId}`]: state,
  }));
}

export function getSectionState(map, stepId, sectionId) {
  return map[`${stepId}:${sectionId}`] || 'untouched';
}

export function getStepCompletion(map, step) {
  const total = step.sections.length;
  let complete = 0;
  let needsAttention = false;
  for (const section of step.sections) {
    const state = getSectionState(map, step.id, section.id);
    if (state === 'complete' || state === 'skipped') complete++;
    if (state === 'needs-attention') needsAttention = true;
  }
  return { total, complete, needsAttention, allComplete: complete === total };
}

export function navigateToSection(stepIndex, sectionIndex) {
  currentStepIndex.set(Math.max(0, Math.min(stepIndex, STEPS.length - 1)));
  const step = STEPS[Math.max(0, Math.min(stepIndex, STEPS.length - 1))];
  currentSectionIndex.set(Math.max(0, Math.min(sectionIndex, step.sections.length - 1)));
}

export function nextSection() {
  let si, sci;
  currentStepIndex.subscribe((v) => si = v)();
  currentSectionIndex.subscribe((v) => sci = v)();
  const step = STEPS[si];
  if (sci < step.sections.length - 1) {
    currentSectionIndex.set(sci + 1);
    return true;
  }
  if (si < STEPS.length - 1) {
    currentStepIndex.set(si + 1);
    currentSectionIndex.set(0);
    return true;
  }
  return false;
}

export function prevSection() {
  let si, sci;
  currentStepIndex.subscribe((v) => si = v)();
  currentSectionIndex.subscribe((v) => sci = v)();
  if (sci > 0) {
    currentSectionIndex.set(sci - 1);
    return true;
  }
  if (si > 0) {
    const prevStep = STEPS[si - 1];
    currentStepIndex.set(si - 1);
    currentSectionIndex.set(prevStep.sections.length - 1);
    return true;
  }
  return false;
}
