import { describe, it, expect } from 'vitest';
import {
  MARKERS,
  escapeHtml,
  escapeJsonPayload,
  fillMarkers,
  findUnfilledMarkers,
  audioSourceTags,
  timecode,
} from './markers.js';

const minimalTemplate = MARKERS.map(m => m.token).join('\n');

function minimalValues() {
  const values = {};
  for (const m of MARKERS) {
    if (m.required) values[m.key] = `filled-${m.key}`;
  }
  return values;
}

describe('fillMarkers', () => {
  it('fills all required markers and produces clean output', () => {
    const values = minimalValues();
    const html = fillMarkers(minimalTemplate, values);
    expect(html).not.toContain('/* JM_');
    expect(html).not.toContain('/* JOURNEY_');
    expect(html).toContain('filled-title');
    expect(html).toContain('filled-runtime');
  });

  it('throws when a required marker has no value', () => {
    const values = minimalValues();
    delete values.title;
    expect(() => fillMarkers(minimalTemplate, values)).toThrow('no value supplied for title');
  });

  it('strips optional markers when omitted', () => {
    const values = minimalValues();
    const html = fillMarkers(minimalTemplate, values);
    expect(html).not.toContain('<!-- DEBUG_PANEL -->');
  });

  it('fills optional markers when provided', () => {
    const values = { ...minimalValues(), debugPanel: '<section>debug</section>' };
    const html = fillMarkers(minimalTemplate, values);
    expect(html).toContain('<section>debug</section>');
  });

  it('detects unfilled markers left after fill', () => {
    const template = '/* JM_TITLE */ extra /* JM_EXTRA_UNKNOWN */';
    const values = minimalValues();
    expect(() => fillMarkers(template, values)).toThrow('unfilled markers remain');
  });

  it('handles $& in replacement values without corruption', () => {
    const values = minimalValues();
    values.title = 'Test $& value $1';
    const html = fillMarkers(minimalTemplate, values);
    expect(html).toContain('Test $& value $1');
  });
});

describe('escapeHtml', () => {
  it('escapes XSS characters', () => {
    expect(escapeHtml('<script>"test"</script>')).toBe('&lt;script&gt;&quot;test&quot;&lt;/script&gt;');
  });

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('escapeJsonPayload', () => {
  it('escapes script-breaking < and >', () => {
    const result = escapeJsonPayload({ value: '</script>' });
    expect(result).not.toContain('</script>');
    expect(result).toContain('\\u003c');
    expect(JSON.parse(result)).toEqual({ value: '</script>' });
  });
});

describe('findUnfilledMarkers', () => {
  it('finds JM_* markers', () => {
    expect(findUnfilledMarkers('hello /* JM_TITLE */ world')).toEqual(['JM_TITLE']);
  });

  it('finds JOURNEY_* markers', () => {
    expect(findUnfilledMarkers('/* JOURNEY_CSS */')).toEqual(['JOURNEY_CSS']);
  });

  it('finds payload markers', () => {
    expect(findUnfilledMarkers('/* ANALYSIS_PAYLOAD */')).toEqual(['ANALYSIS_PAYLOAD']);
  });

  it('finds HTML comment markers', () => {
    expect(findUnfilledMarkers('<!-- JM_AUDIO_SOURCES -->')).toEqual(['JM_AUDIO_SOURCES']);
  });

  it('does not match TX_* markers', () => {
    expect(findUnfilledMarkers('/* TX_TITLE */')).toEqual([]);
  });

  it('returns empty for clean output', () => {
    expect(findUnfilledMarkers('clean html with no markers')).toEqual([]);
  });
});

describe('audioSourceTags', () => {
  it('generates source elements', () => {
    const result = audioSourceTags([{ src: 'track.mp3', type: 'audio/mpeg' }]);
    expect(result).toContain('<source src="track.mp3" type="audio/mpeg">');
  });

  it('skips entries without src', () => {
    expect(audioSourceTags([{ type: 'audio/mpeg' }, null])).toBe('');
  });
});

describe('timecode', () => {
  it('formats seconds to mm:ss', () => {
    expect(timecode(0)).toBe('0:00');
    expect(timecode(65)).toBe('1:05');
    expect(timecode(3600)).toBe('60:00');
  });

  it('handles NaN and negative', () => {
    expect(timecode(NaN)).toBe('0:00');
    expect(timecode(-5)).toBe('0:00');
  });
});
