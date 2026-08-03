import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * The experience menu is opened and closed by one control.
 *
 * It used to have two: a hamburger at top left to open, and a separate × at
 * top right to close. The × was positioned `right:18px`, which is exactly
 * where the viewer paints the package's own close button — so on a phone the
 * two overlapped and closing the menu was a coin toss.
 *
 * The stacking detail is the part worth pinning: the drawer is z-index 80, so
 * a hamburger below that is covered the moment the menu opens, which is what
 * forced the second button in the first place.
 */

function cssValue(selector, prop) {
  const start = ULTRA_HTML.indexOf(`${selector}{`);
  if (start < 0) return null;
  const block = ULTRA_HTML.slice(start, ULTRA_HTML.indexOf('}', start));
  const match = block.match(new RegExp(`${prop}:\\s*([^;]+)`));
  return match ? match[1].trim() : null;
}

describe('experience menu control', () => {
  it('has no separate close button', () => {
    expect(ULTRA_HTML).not.toContain('id="menu-close"');
    expect(ULTRA_HTML).not.toContain('.menu-close{');
  });

  it('keeps the one control above the drawer so it stays clickable', () => {
    const button = Number(cssValue('.guide-btn', 'z-index'));
    const drawer = Number(cssValue('.guide-drawer', 'z-index'));

    expect(Number.isFinite(button)).toBe(true);
    expect(Number.isFinite(drawer)).toBe(true);
    expect(button, 'hamburger must sit above the drawer it toggles')
      .toBeGreaterThan(drawer);
  });

  it('anchors the control away from the package close button', () => {
    // The package paints its own close top right. Ours stays left.
    expect(cssValue('.guide-btn', 'left')).toBeTruthy();
    expect(cssValue('.guide-btn', 'right')).toBeNull();
  });

  it('toggles rather than only opening', () => {
    expect(ULTRA_HTML).toContain("menuButton.addEventListener('click',toggleDrawer)");
    expect(ULTRA_HTML).toContain('function toggleDrawer()');
  });

  it('keeps the accessible name and glyph honest in both states', () => {
    // A control that says "Open" while the menu is open is worse than no
    // label at all for anyone using a screen reader.
    expect(ULTRA_HTML).toContain("menuButton.setAttribute('aria-label','Close experience menu')");
    expect(ULTRA_HTML).toContain("menuButton.setAttribute('aria-label','Open experience menu')");
    expect(ULTRA_HTML).toContain("menuButton.setAttribute('aria-expanded','true')");
    expect(ULTRA_HTML).toContain("menuButton.setAttribute('aria-expanded','false')");
  });

  it('still closes on Escape', () => {
    expect(ULTRA_HTML).toMatch(/Escape'&&drawer\.classList\.contains\('open'\)\)\s*closeDrawer/);
  });

  it('moves focus into the menu on open, not onto a button that no longer exists', () => {
    expect(ULTRA_HTML).toContain(".world-link:not([hidden])");
  });

  it('renumbers the menu so hidden entries do not leave gaps', () => {
    // Indices are authored 01-08, but entries hide when a package has no
    // lyrics or games, which showed up as "01, 03, 04" to the collector.
    expect(ULTRA_HTML).toContain('function renumberMenu()');
    const open = ULTRA_HTML.slice(
      ULTRA_HTML.indexOf('function openDrawer()'),
      ULTRA_HTML.indexOf('function closeDrawer()'),
    );
    expect(open, 'renumbering must run before the drawer is shown')
      .toContain('renumberMenu()');
  });
});
