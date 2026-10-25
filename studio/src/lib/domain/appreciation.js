/** Apply an optimistic appreciation change and restore the prior state on failure. */
export function appreciationPressedState(value) {
  return Boolean(value);
}

export async function setAppreciationOptimistically({ current, send, onState }) {
  const desired = !Boolean(current);
  onState(desired);

  try {
    const confirmed = await send(desired);
    const next = Boolean(confirmed);
    onState(next);
    return { ok: true, appreciated: next };
  } catch (error) {
    onState(Boolean(current));
    return { ok: false, appreciated: Boolean(current), error };
  }
}
