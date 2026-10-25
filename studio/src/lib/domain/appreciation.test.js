import { describe, expect, it, vi } from 'vitest';
import { appreciationPressedState, setAppreciationOptimistically } from './appreciation.js';

describe('appreciation state', () => {
  it('optimistically adds an appreciation and confirms the returned state', async () => {
    const onState = vi.fn();
    const result = await setAppreciationOptimistically({
      current: false,
      send: async (desired) => desired,
      onState,
    });

    expect(onState.mock.calls.map(([value]) => value)).toEqual([true, true]);
    expect(result).toEqual({ ok: true, appreciated: true });
  });

  it('rolls optimistic state back when the request fails', async () => {
    const onState = vi.fn();
    const failure = new Error('Network unavailable');
    const result = await setAppreciationOptimistically({
      current: true,
      send: async () => { throw failure; },
      onState,
    });

    expect(onState.mock.calls.map(([value]) => value)).toEqual([false, true]);
    expect(result.ok).toBe(false);
    expect(result.appreciated).toBe(true);
    expect(result.error).toBe(failure);
  });

  it('preserves an accessible pressed state source when repeated desired states are returned', async () => {
    let appreciated = false;
    await setAppreciationOptimistically({
      current: appreciated,
      send: async () => true,
      onState: (value) => { appreciated = value; },
    });
    expect(appreciationPressedState(appreciated)).toBe(true);
    expect(appreciationPressedState(false)).toBe(false);
  });
});
