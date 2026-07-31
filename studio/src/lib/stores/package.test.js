import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { assets, identity, manifest, play, releaseProject, GAME_CATALOG } from './package.js';

describe('GAME_CATALOG invariants', () => {
  it('has nine games with unique ids and complete display fields', () => {
    expect(GAME_CATALOG).toHaveLength(9);
    const ids = GAME_CATALOG.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GAME_CATALOG) {
      expect(g.id).toMatch(/^[a-z]+$/);
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.hint.length).toBeGreaterThan(0);
      expect(['toy', 'rhythm', 'arcade']).toContain(g.kind);
    }
  });

  it('play store defaults to no games at standard difficulty, intensity 1', () => {
    const p = get(play);
    expect(p).toEqual({ games: [], difficulty: 'standard', intensity: 1 });
    // default intensity sits inside the UI slider range (0.4–1.4)
    expect(p.intensity).toBeGreaterThanOrEqual(0.4);
    expect(p.intensity).toBeLessThanOrEqual(1.4);
  });
});

describe('normalized package store', () => {
  it('uses a release-wide project as the canonical source of truth', () => {
    const project = get(releaseProject);
    expect(project.release.release_type).toBe('single');
    expect(project.tracks).toHaveLength(1);
    expect(project.edition).toMatchObject({
      release_id: project.release.release_id,
      applies_to: 'release',
      edition_type: 'fixed',
    });
  });

  it('keeps current single-track screens connected through compatibility lenses', () => {
    identity.update((value) => ({ ...value, artist: 'dBoy', title: 'Steady', genre: 'Soul, Electronic' }));
    const audioFile = { name: 'steady.wav', type: 'audio/wav', size: 4096 };
    assets.update((value) => ({ ...value, audioFile, audioName: audioFile.name }));

    const project = get(releaseProject);
    expect(project.release).toMatchObject({
      primary_artist: 'dBoy',
      title: 'Steady',
      genre: ['Soul', 'Electronic'],
    });
    expect(project.tracks[0]).toMatchObject({ title: 'Steady', primary_artist: 'dBoy' });
    expect(project.audio_versions[0]).toMatchObject({ role: 'primary_master', track_id: project.tracks[0].track_id });
    expect(project.audio_assets[0]).toMatchObject({ role: 'primary_master', file: audioFile });
    expect(get(manifest)).toMatchObject({
      package_type: 'music_release',
      release: { track_count: 1 },
      tracks: [{ title: 'Steady', primary_audio_component: project.audio_assets[0].asset_id }],
    });
  });
});
