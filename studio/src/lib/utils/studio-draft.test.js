import { describe, expect, it } from 'vitest';
import { loadStudioDraft, sanitizeDraftForJson, saveStudioDraft } from './studio-draft.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('Studio draft persistence', () => {
  it('preserves uploaded blobs through the durable driver', async () => {
    const values = new Map();
    const driver = { get: async (key) => values.get(key), set: async (key, value) => values.set(key, value) };
    const file = new Blob(['audio'], { type: 'audio/wav' });
    await saveStudioDraft('creator-1', { project: { audio_assets: [{ filename: 'song.wav', file }] } }, {
      driver,
      storage: memoryStorage(),
      savedAt: '2026-08-01T00:00:00.000Z',
    });
    const restored = await loadStudioDraft('creator-1', { driver, storage: memoryStorage() });
    expect(restored.snapshot.project.audio_assets[0].file).toBe(file);
    expect(restored.durableFiles).toBe(true);
  });

  it('creates a metadata recovery copy without trying to JSON-encode file bytes', () => {
    const sanitized = sanitizeDraftForJson({ filename: 'song.wav', file: new Blob(['audio']) });
    expect(sanitized).toEqual({ filename: 'song.wav', file: null });
  });

  it('falls back to creator-scoped local storage', async () => {
    const storage = memoryStorage();
    await saveStudioDraft('creator-a', { currentStep: 6, title: 'A' }, { indexedDBRef: null, storage });
    await saveStudioDraft('creator-b', { currentStep: 2, title: 'B' }, { indexedDBRef: null, storage });
    expect((await loadStudioDraft('creator-a', { indexedDBRef: null, storage })).snapshot.title).toBe('A');
    expect((await loadStudioDraft('creator-b', { indexedDBRef: null, storage })).snapshot.currentStep).toBe(2);
  });

  it('reports an error when every browser persistence mechanism is blocked', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    await expect(saveStudioDraft('creator-a', { title: 'Unsaved' }, { indexedDBRef: null, storage: blocked }))
      .rejects.toThrow('does not provide persistent draft storage');
  });
});
