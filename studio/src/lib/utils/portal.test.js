import { afterEach, describe, expect, it, vi } from 'vitest';
import { portal } from './portal.js';

/**
 * There is no DOM environment configured for this suite and adding one for a
 * twenty-line utility is not worth the dependency, so this drives `portal`
 * against a stub implementing only the four methods it actually uses. The
 * behaviour against a real browser is verified separately; what is worth
 * pinning here is the contract, especially the double-removal guard.
 */
function makeNode() {
  const node = { parentNode: null };
  return node;
}

function makeHost() {
  const host = {
    children: [],
    appendChild(node) {
      node.parentNode?.removeChild(node);
      host.children.push(node);
      node.parentNode = host;
      return node;
    },
    removeChild(node) {
      host.children = host.children.filter((child) => child !== node);
      node.parentNode = null;
      return node;
    },
  };
  return host;
}

const originalDocument = globalThis.document;
afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

describe('portal', () => {
  it('moves the node into the given host element', () => {
    const host = makeHost();
    const node = makeNode();

    portal(node, host);

    expect(host.children).toEqual([node]);
    expect(node.parentNode).toBe(host);
  });

  it('resolves a string target through document.querySelector', () => {
    const host = makeHost();
    const querySelector = vi.fn(() => host);
    globalThis.document = { querySelector };
    const node = makeNode();

    portal(node);                       // defaults to 'body'

    expect(querySelector).toHaveBeenCalledWith('body');
    expect(host.children).toEqual([node]);
  });

  it('detaches the node on destroy', () => {
    const host = makeHost();
    const node = makeNode();

    portal(node, host).destroy();

    expect(host.children).toEqual([]);
    expect(node.parentNode).toBe(null);
  });

  it('does not throw when Svelte has already detached the node', () => {
    // Svelte removes the node itself on unmount, so destroy() routinely runs
    // against an already-detached node. Throwing here would break teardown.
    const host = makeHost();
    const node = makeNode();
    const handle = portal(node, host);

    host.removeChild(node);             // simulate Svelte's own detach

    expect(() => handle.destroy()).not.toThrow();
  });

  it('survives a host that does not exist', () => {
    globalThis.document = { querySelector: () => null };
    const node = makeNode();

    expect(() => portal(node, '#nowhere')).not.toThrow();
    expect(node.parentNode).toBe(null);
  });

  it('relocates the node when the target changes', () => {
    const first = makeHost();
    const second = makeHost();
    const node = makeNode();

    const handle = portal(node, first);
    handle.update(second);

    expect(first.children).toEqual([]);
    expect(second.children).toEqual([node]);
  });
});
