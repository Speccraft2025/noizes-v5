const FIELD_TIME_BINS = 96;
const FIELD_BAND_BINS = 48;
const WORLD_WIDTH = 14000;
const WORLD_DEPTH = 12000;
const TIME_SPAN = 0.84;
const BAND_SPAN = 0.68;

export function buildSpectralWorld({ trackId = '', analysis = {}, terrainData } = {}) {
  if (!(terrainData?.rgba instanceof Uint8Array) || terrainData.width < 2 || terrainData.height < 2) {
    throw new Error('Transcendence V3 needs measured RGBA spectrogram samples.');
  }

  const durationSeconds = Number(analysis.duration_seconds) || 0;
  if (!(durationSeconds > 0)) throw new Error('Transcendence V3 needs a measured track duration.');

  const field = downsampleSpectrogram(terrainData);
  const seed = stableSeed(trackId, terrainData.rgba);
  const ranges = deriveRanges(field, analysis, durationSeconds, seed);
  const massifs = deriveMassifs(field, analysis, durationSeconds, seed);
  const troughs = deriveTroughs(field, analysis, durationSeconds, seed);
  const basins = deriveBasins(field, analysis, durationSeconds, seed);

  return {
    schema: 'transcendence-world-v3',
    generation: 3,
    deterministic: true,
    seed,
    width: WORLD_WIDTH,
    depth: WORLD_DEPTH,
    segmentsX: 480,
    segmentsZ: 420,
    baseHeight: 118,
    macroScale: 0.00042,
    macroAmplitude: 28,
    continentScale: 0.0007,
    continentAmplitude: 18,
    mesoScale: 0.0017,
    mesoAmplitude: 22,
    microScale: 0.009,
    microAmplitude: 8,
    spectralAmplitude: 105,
    edgeLift: 220,
    noiseOffsetX: (seed % 8191) * 0.013,
    noiseOffsetZ: ((seed >>> 8) % 8191) * 0.017,
    spectralField: {
      schema: 'spectrogram-field-v1',
      width: field.width,
      height: field.height,
      channels: ['energy', 'harmonic', 'transient', 'ridge'],
      data: Array.from(field.data),
      worldMapping: {
        timeAxis: 'x',
        frequencyAxis: 'z',
        timeStartX: round(-WORLD_WIDTH * TIME_SPAN * 0.5),
        timeEndX: round(WORLD_WIDTH * TIME_SPAN * 0.5),
        lowBandZ: round(-WORLD_DEPTH * BAND_SPAN * 0.5),
        highBandZ: round(WORLD_DEPTH * BAND_SPAN * 0.5),
        durationSeconds,
      },
      source: {
        frames: terrainData.width,
        bands: terrainData.height,
        bandCentresHz: analysis.parameters?.terrain?.band_centres_hz ?? [],
      },
    },
    ranges,
    massifs,
    troughs,
    basins,
    shots: defaultShots(),
    fidelity: {
      classification: 'spectrogram-derived geography',
      macro: 'persistent harmonic and ridge energy',
      localizedMassifs: 'time-frequency energy and transient maxima',
      depressions: 'measured low-energy regions',
      surface: 'baked four-channel spectrogram field',
      regularization: 'low-amplitude deterministic geological noise',
    },
  };
}

export function worldXFromSeconds(seconds, durationSeconds) {
  const progress = clamp(seconds / Math.max(durationSeconds, 0.001), 0, 1);
  return (progress - 0.5) * WORLD_WIDTH * TIME_SPAN;
}

export function worldZFromBandFraction(fraction) {
  return (clamp(fraction, 0, 1) - 0.5) * WORLD_DEPTH * BAND_SPAN;
}

function downsampleSpectrogram({ rgba, width, height }) {
  const data = new Uint8Array(FIELD_TIME_BINS * FIELD_BAND_BINS * 4);
  for (let bandBin = 0; bandBin < FIELD_BAND_BINS; bandBin += 1) {
    const bandStart = Math.floor((bandBin / FIELD_BAND_BINS) * height);
    const bandEnd = Math.max(bandStart + 1, Math.floor(((bandBin + 1) / FIELD_BAND_BINS) * height));
    for (let timeBin = 0; timeBin < FIELD_TIME_BINS; timeBin += 1) {
      const frameStart = Math.floor((timeBin / FIELD_TIME_BINS) * width);
      const frameEnd = Math.max(frameStart + 1, Math.floor(((timeBin + 1) / FIELD_TIME_BINS) * width));
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let band = bandStart; band < Math.min(height, bandEnd); band += 1) {
        const pngRow = height - 1 - band;
        for (let frame = frameStart; frame < Math.min(width, frameEnd); frame += 1) {
          const source = (pngRow * width + frame) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += rgba[source + channel];
          count += 1;
        }
      }
      const target = (bandBin * FIELD_TIME_BINS + timeBin) * 4;
      for (let channel = 0; channel < 4; channel += 1) data[target + channel] = Math.round(sums[channel] / Math.max(count, 1));
    }
  }
  return { width: FIELD_TIME_BINS, height: FIELD_BAND_BINS, data };
}

function deriveRanges(field, analysis, durationSeconds, seed) {
  return Array.from({ length: 4 }, (_, section) => {
    const start = Math.floor((section / 4) * field.width);
    const end = Math.floor(((section + 1) / 4) * field.width);
    let best = { score: -1, band: 0, time: start, persistence: 0, energy: 0, harmonic: 0, ridge: 0 };
    for (let band = 1; band < field.height - 1; band += 1) {
      let score = 0;
      let weightedTime = 0;
      let weight = 0;
      let active = 0;
      let energyTotal = 0;
      let harmonicTotal = 0;
      let ridgeTotal = 0;
      for (let time = start; time < end; time += 1) {
        const sample = fieldSample(field, time, band, 1);
        const local = sample.energy * (0.5 + sample.harmonic * 0.28 + sample.ridge * 0.38);
        score += local;
        weightedTime += time * local;
        weight += local;
        if (sample.energy > 0.42 || sample.ridge > 0.48) active += 1;
        energyTotal += sample.energy;
        harmonicTotal += sample.harmonic;
        ridgeTotal += sample.ridge;
      }
      if (score > best.score) {
        const count = Math.max(end - start, 1);
        best = {
          score,
          band,
          time: weight > 0 ? weightedTime / weight : (start + end) * 0.5,
          persistence: active / count,
          energy: energyTotal / count,
          harmonic: harmonicTotal / count,
          ridge: ridgeTotal / count,
        };
      }
    }
    const seconds = binToSeconds(best.time, field.width, durationSeconds);
    const bandFraction = best.band / Math.max(field.height - 1, 1);
    const spanSeconds = durationSeconds / 4;
    return {
      x: worldXFromSeconds(seconds, durationSeconds),
      z: worldZFromBandFraction(bandFraction),
      dirX: 0.995,
      dirZ: ((hashUnit(seed + section * 31) - 0.5) * 0.16),
      length: clamp(1550 + spanSeconds * 18 + best.persistence * 1900, 1900, 4700),
      width: clamp(470 + best.ridge * 260 + best.harmonic * 170, 470, 860),
      height: clamp(250 + best.energy * 300 + best.ridge * 170, 290, 650),
      spineScale: 0.0017 + best.ridge * 0.00045,
      crossScale: 0.0032 + best.harmonic * 0.0005,
      warpScale: 0.00125,
      seed: round(3 + hashUnit(seed + section * 97) * 28),
      spectralSource: sourceRecord('persistent-range', seconds, bandFraction, analysis, best),
    };
  });
}

function deriveMassifs(field, analysis, durationSeconds, seed) {
  const candidates = [];
  for (let band = 2; band < field.height - 2; band += 2) {
    for (let time = 2; time < field.width - 2; time += 2) {
      const sample = fieldSample(field, time, band, 1);
      const score = sample.energy * 0.62 + sample.transient * 0.23 + sample.ridge * 0.15;
      if (score > 0.42) candidates.push({ time, band, score, ...sample });
    }
  }
  const selected = separated(candidates.sort((a, b) => b.score - a.score), 10, 6, 10);
  return selected.map((candidate, index) => {
    const seconds = binToSeconds(candidate.time, field.width, durationSeconds);
    const bandFraction = candidate.band / Math.max(field.height - 1, 1);
    return {
      x: worldXFromSeconds(seconds, durationSeconds),
      z: worldZFromBandFraction(bandFraction),
      radiusX: clamp(380 + candidate.energy * 310 + candidate.transient * 180, 420, 840),
      radiusZ: clamp(320 + candidate.ridge * 220 + candidate.harmonic * 120, 340, 650),
      height: clamp(150 + candidate.energy * 260 + candidate.transient * 190, 190, 520),
      scale: 0.0038 + candidate.ridge * 0.0007,
      seed: round(2 + hashUnit(seed + index * 131) * 30),
      spectralSource: sourceRecord('localized-massif', seconds, bandFraction, analysis, candidate),
    };
  });
}

function deriveTroughs(field, analysis, durationSeconds, seed) {
  const envelope = timeEnvelope(field);
  return Array.from({ length: 3 }, (_, section) => {
    const start = Math.floor(((section + 0.12) / 3) * field.width);
    const end = Math.floor(((section + 0.88) / 3) * field.width);
    let time = start;
    for (let index = start + 1; index < end; index += 1) if (envelope[index] < envelope[time]) time = index;
    let band = 1;
    let quietest = Infinity;
    for (let candidate = 1; candidate < field.height - 1; candidate += 1) {
      const sample = fieldSample(field, time, candidate, 2);
      const value = sample.energy + sample.ridge * 0.25;
      if (value < quietest) { quietest = value; band = candidate; }
    }
    const sample = fieldSample(field, time, band, 2);
    const seconds = binToSeconds(time, field.width, durationSeconds);
    const bandFraction = band / Math.max(field.height - 1, 1);
    const silence = 1 - clamp(envelope[time], 0, 1);
    return {
      x: worldXFromSeconds(seconds, durationSeconds),
      z: worldZFromBandFraction(bandFraction),
      dirX: 0.995,
      dirZ: (hashUnit(seed + section * 173) - 0.5) * 0.14,
      length: clamp(1650 + silence * 2100, 1800, 3900),
      width: clamp(640 + silence * 330, 680, 1040),
      depth: clamp(330 + silence * 300, 360, 650),
      floorScale: 0.00135,
      shelfScale: 0.00255,
      seed: round(4 + hashUnit(seed + section * 211) * 27),
      spectralSource: sourceRecord('measured-trough', seconds, bandFraction, analysis, { ...sample, silence }),
    };
  });
}

function deriveBasins(field, analysis, durationSeconds, seed) {
  const candidates = [];
  for (let band = 3; band < field.height - 3; band += 3) {
    for (let time = 4; time < field.width - 4; time += 4) {
      const sample = fieldSample(field, time, band, 2);
      const quiet = 1 - (sample.energy * 0.8 + sample.ridge * 0.2);
      if (quiet > 0.48) candidates.push({ time, band, score: quiet, ...sample });
    }
  }
  const selected = separated(candidates.sort((a, b) => b.score - a.score), 16, 10, 3);
  return selected.map((candidate, index) => {
    const seconds = binToSeconds(candidate.time, field.width, durationSeconds);
    const bandFraction = candidate.band / Math.max(field.height - 1, 1);
    return {
      x: worldXFromSeconds(seconds, durationSeconds),
      z: worldZFromBandFraction(bandFraction),
      radiusX: 620 + candidate.score * 300,
      radiusZ: 480 + candidate.score * 240,
      depth: 100 + candidate.score * 130,
      scale: 0.00265 + hashUnit(seed + index * 19) * 0.0004,
      seed: round(7 + hashUnit(seed + index * 251) * 24),
      spectralSource: sourceRecord('measured-basin', seconds, bandFraction, analysis, candidate),
    };
  });
}

function fieldSample(field, time, band, radius = 0) {
  const sums = [0, 0, 0, 0];
  let count = 0;
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = clamp(Math.round(time + dx), 0, field.width - 1);
      const z = clamp(Math.round(band + dz), 0, field.height - 1);
      const offset = (z * field.width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) sums[channel] += field.data[offset + channel] / 255;
      count += 1;
    }
  }
  return { energy: sums[0] / count, harmonic: sums[1] / count, transient: sums[2] / count, ridge: sums[3] / count };
}

function timeEnvelope(field) {
  return Array.from({ length: field.width }, (_, time) => {
    let total = 0;
    for (let band = 0; band < field.height; band += 1) total += fieldSample(field, time, band).energy;
    return total / field.height;
  }).map((_, time, values) => {
    let total = 0;
    let count = 0;
    for (let offset = -3; offset <= 3; offset += 1) {
      const index = time + offset;
      if (index >= 0 && index < values.length) { total += values[index]; count += 1; }
    }
    return total / count;
  });
}

function sourceRecord(kind, seconds, bandFraction, analysis, metrics) {
  const centres = analysis.parameters?.terrain?.band_centres_hz ?? [];
  const bandIndex = Math.round(bandFraction * Math.max(centres.length - 1, 0));
  return {
    kind,
    seconds: round(seconds, 3),
    bandFraction: round(bandFraction, 4),
    bandIndex,
    hz: centres[bandIndex] ?? null,
    metrics: Object.fromEntries(['energy', 'harmonic', 'transient', 'ridge', 'persistence', 'silence']
      .filter((key) => Number.isFinite(metrics[key]))
      .map((key) => [key, round(metrics[key], 4)])),
  };
}

function separated(candidates, timeDistance, bandDistance, limit) {
  const selected = [];
  for (const candidate of candidates) {
    if (selected.every((entry) => Math.abs(entry.time - candidate.time) >= timeDistance || Math.abs(entry.band - candidate.band) >= bandDistance)) {
      selected.push(candidate);
    }
    if (selected.length === limit) break;
  }
  return selected;
}

function defaultShots() {
  return {
    aerial: { position: { x: -3200, y: 0, z: 2300 }, target: { x: 0, y: 0, z: 0 }, fov: 62 },
    trough: { position: { x: -800, y: 0, z: 0 }, target: { x: 1300, y: 0, z: 0 }, fov: 47 },
    crest: { position: { x: 900, y: 0, z: 0 }, target: { x: 2100, y: 0, z: 0 }, fov: 52 },
  };
}

function binToSeconds(bin, bins, durationSeconds) {
  return (bin / Math.max(bins - 1, 1)) * durationSeconds;
}

function stableSeed(trackId, bytes) {
  let hash = 2166136261;
  for (const char of String(trackId)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const stride = Math.max(1, Math.floor(bytes.length / 4096));
  for (let index = 0; index < bytes.length; index += stride) hash = Math.imul(hash ^ bytes[index], 16777619);
  return hash >>> 0;
}

function hashUnit(value) {
  const sample = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return sample - Math.floor(sample);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 3) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
