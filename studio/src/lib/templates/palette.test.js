import { describe, expect, it } from 'vitest';
import ULTRA_HTML from './ULTRA.html?raw';

/**
 * The object wears the record's colours, not the label's.
 *
 * Noizes purple is a brand asset. Baked into every package it makes each
 * release look like a Noizes product page instead of that artist's record, so
 * the palette is derived from the cover at boot and pushed into the CSS
 * variables the rest of the document already reads.
 *
 * These run the real derivation against synthetic cover pixels rather than
 * asserting on source text, because the failure that matters is "the teal
 * sleeve produced a purple highlight", not "the file mentions a function".
 */

/** Helpers plus the derivation, up to the point where it touches the DOM. */
function paletteSource() {
  const start = ULTRA_HTML.indexOf('function nzRgbToHsl(');
  const end = ULTRA_HTML.indexOf('function nzApplyPalette(', start);
  if (start < 0 || end < 0) throw new Error('palette section not found in ULTRA.html');
  return ULTRA_HTML.slice(start, end);
}

/** Boots the derivation over a cover made of the given RGB pixels. */
function boot(pixels) {
  const size = 56;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = pixels[i % pixels.length];
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  const document = {
    createElement: () => ({
      getContext: () => ({ drawImage() {}, getImageData: () => ({ data }) }),
    }),
  };
  const factory = new Function('document', `${paletteSource()}
    return { derive: nzDerivePalette, luma: nzLuma, toHsl: nzRgbToHsl };`);
  const api = factory(document);
  return { ...api, palette: api.derive({}) };
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hueOf = (api, hex) => api.toHsl(...hexToRgb(hex))[0];
const satOf = (api, hex) => api.toHsl(...hexToRgb(hex))[1];
const lightOf = (api, hex) => api.toHsl(...hexToRgb(hex))[2];
/** Shortest distance between two hues on the wheel. */
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

const NOIZES_PURPLE_HUE = 258;   // #7B5CF0

describe('the cover decides the palette', () => {
  it('takes its primary from the artwork, not the brand', () => {
    // A teal sleeve: the highlight has to be teal.
    const api = boot([[13, 92, 99], [23, 195, 178], [4, 38, 43]]);
    const hue = hueOf(api, api.palette.primary);

    expect(hueGap(hue, 175), `primary hue was ${Math.round(hue)}`).toBeLessThan(30);
    expect(hueGap(hue, NOIZES_PURPLE_HUE), 'primary must not land on brand purple')
      .toBeGreaterThan(60);
  });

  it('follows the cover wherever it goes', () => {
    const warm = boot([[196, 62, 18], [230, 120, 40], [60, 18, 6]]);
    const cold = boot([[26, 48, 160], [60, 90, 220], [8, 12, 44]]);

    expect(hueGap(hueOf(warm, warm.palette.primary), 22)).toBeLessThan(35);
    expect(hueGap(hueOf(cold, cold.palette.primary), 226)).toBeLessThan(35);
  });

  it('lifts a colour too dark or too washed to read on a black stage', () => {
    // A muddy sleeve still has to produce a usable highlight.
    const api = boot([[26, 48, 40], [18, 36, 30], [30, 54, 46]]);
    const l = lightOf(api, api.palette.primary);
    const s = satOf(api, api.palette.primary);

    expect(l, 'primary must be light enough to read').toBeGreaterThanOrEqual(0.5);
    expect(l, 'primary must not blow out to white').toBeLessThanOrEqual(0.75);
    expect(s, 'primary must stay a colour, not a grey').toBeGreaterThanOrEqual(0.4);
  });

  it('picks an accent that is a different colour, not a shade of the primary', () => {
    const api = boot([[23, 195, 178], [250, 164, 56], [4, 38, 43]]);
    const gap = hueGap(hueOf(api, api.palette.primary), hueOf(api, api.palette.accent));
    expect(gap, 'accent must be distinguishable from primary').toBeGreaterThanOrEqual(30);
  });

  it('invents no colour for a monochrome sleeve, and still avoids purple', () => {
    const api = boot([[18, 18, 18], [128, 128, 128], [235, 235, 235]]);
    expect(satOf(api, api.palette.primary), 'a grey cover must not gain a hue')
      .toBeLessThan(0.2);
    expect(hueGap(hueOf(api, api.palette.primary), NOIZES_PURPLE_HUE)).toBeGreaterThan(30);
  });

  it('keeps the background the cover’s colour at almost no light', () => {
    const api = boot([[13, 92, 99], [23, 195, 178], [4, 38, 43]]);
    expect(lightOf(api, api.palette.bg), 'the stage must stay near-black')
      .toBeLessThan(0.09);
    expect(hueGap(hueOf(api, api.palette.bg), hueOf(api, api.palette.primary)))
      .toBeLessThan(20);
  });

  it('flips label ink to dark on a bright accent so it stays readable', () => {
    // Type on the play button is painted with --on-primary. White on yellow is
    // the failure this exists to prevent.
    const bright = boot([[255, 225, 40], [250, 240, 120], [40, 36, 6]]);
    const deep = boot([[40, 20, 140], [70, 40, 190], [10, 6, 30]]);

    expect(bright.palette.onPrimary).toBe('#0b0a0d');
    expect(deep.palette.onPrimary).toBe('#ffffff');
    expect(bright.luma(hexToRgb(bright.palette.primary))).toBeGreaterThan(0.52);
  });

  it('exposes the soft and glow tints the stage paints its halos with', () => {
    const api = boot([[13, 92, 99], [23, 195, 178], [4, 38, 43]]);
    const rgb = hexToRgb(api.palette.primary).join(',');
    expect(api.palette.soft).toBe(`rgba(${rgb},0.16)`);
    expect(api.palette.glow).toBe(`rgba(${rgb},0.42)`);
    expect(api.palette.derived).toBe(true);
  });
});

describe('the package survives a cover it cannot read', () => {
  it('keeps the configured theme when pixel access is refused', () => {
    // A tainted canvas throws out of getImageData. The listener should get the
    // fallback theme, not a blank stage.
    const boot = () => {
      const document = {
        createElement: () => ({
          getContext: () => ({
            drawImage() {},
            getImageData() { throw new Error('SecurityError: tainted canvas'); },
          }),
        }),
      };
      const factory = new Function('document', `${paletteSource()}
        return { derive: nzDerivePalette };`);
      return factory(document);
    };
    expect(() => boot().derive({})).toThrow();

    // …and the caller is the thing that swallows it.
    const guarded = ULTRA_HTML.slice(
      ULTRA_HTML.indexOf('probe.onload=function()'),
      ULTRA_HTML.indexOf('probe.src=C.coverSrc'),
    );
    expect(guarded).toContain('try{');
    expect(guarded).toContain('catch(ignore)');
  });
});
