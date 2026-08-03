/**
 * Move a node to the end of <body>.
 *
 * Overlays cannot trust where they are mounted. `position: fixed` is resolved
 * against the nearest ancestor with a transform, filter or backdrop-filter
 * rather than the viewport, and those same properties open a stacking context
 * that caps z-index inside it. The Studio's `.glass` uses backdrop-filter, so
 * any overlay rendered inside a glass panel would be positioned to that panel
 * and could sit behind other chrome.
 *
 * Reparenting to <body> removes the dependency on wherever the component
 * happens to be mounted, which is the only version of this that stays correct
 * when someone moves the markup later.
 */
export function portal(node, target = 'body') {
  let host = null;

  function mount(to) {
    host = typeof to === 'string' ? document.querySelector(to) : to;
    if (host) host.appendChild(node);
  }

  mount(target);

  return {
    update(to) {
      mount(to);
    },
    destroy() {
      // Svelte detaches the node itself on unmount; only clean up if it is
      // still attached, so we never throw on a double removal.
      if (node.parentNode) node.parentNode.removeChild(node);
    },
  };
}
