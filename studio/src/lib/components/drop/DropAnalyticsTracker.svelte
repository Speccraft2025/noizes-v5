<script>
  // Fire-and-forget counters for interactions. The page view itself is counted
  // server-side during load, so nothing is sent on mount.
  //
  // Nothing here blocks a render and every failure is swallowed: a Drop Page
  // whose acquire button stops working because a counter endpoint is down has
  // its priorities backwards.
  export let releaseId;

  let queue = [];
  let flushing = false;

  export function track(event) {
    if (!releaseId || !event) return;
    queue = [...queue, event];
    flush();
  }

  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue;
    queue = [];
    try {
      await fetch('/drop/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ release_id: releaseId, events: batch }),
        keepalive: true,
      });
    } catch {
      // Deliberately silent: an uncounted view is not worth a console error
      // on a page a stranger just opened.
    } finally {
      flushing = false;
      if (queue.length) flush();
    }
  }
</script>
