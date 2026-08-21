/** Build the worker completion message without dropping raw terrain samples. */
export function terrainWorkerCompletion(result) {
  if (!(result?.terrainPng instanceof Uint8Array)) {
    throw new TypeError('Terrain worker completed without PNG bytes.');
  }
  if (!(result?.terrainRGBA instanceof Uint8Array)) {
    throw new TypeError('Terrain worker completed without raw terrain samples.');
  }
  return {
    message: { type: 'done', result },
    transfer: [result.terrainPng.buffer, result.terrainRGBA.buffer],
  };
}
