import { describe, expect, it } from 'vitest';
import { terrainWorkerCompletion } from './workerProtocol.js';

describe('terrain worker completion protocol', () => {
  it('returns the complete pipeline result and transfers both large buffers', () => {
    const result = {
      terrainPng: new Uint8Array([137, 80, 78, 71]),
      terrainRGBA: new Uint8Array([12, 34, 56, 255]),
      width: 1,
      height: 1,
      analysis: { duration_seconds: 1 },
    };
    const completion = terrainWorkerCompletion(result);

    expect(completion.message).toEqual({ type: 'done', result });
    expect(completion.message.result.terrainRGBA).toBe(result.terrainRGBA);
    expect(completion.transfer).toEqual([result.terrainPng.buffer, result.terrainRGBA.buffer]);
  });

  it('fails explicitly if raw samples are ever omitted again', () => {
    expect(() => terrainWorkerCompletion({ terrainPng: new Uint8Array([1]) }))
      .toThrow(/raw terrain samples/i);
  });
});
