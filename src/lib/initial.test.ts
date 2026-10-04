import { describe, expect, it, vi } from 'vitest';
import { initialOf } from './initial';

describe('initialOf', () => {
  it.each([
    ['Balanz', 'B'],
    ['binance', 'B'],
    ['  émile', 'É'],
    ['Émile', 'É'],
    ['\u{1F1E6}\u{1F1F7} Balanz', '\u{1F1E6}\u{1F1F7}'],
    ['\u{1F44D}\u{1F3FD} ok', '\u{1F44D}\u{1F3FD}'],
    ['\u{1F468}‍\u{1F469}‍\u{1F467} family', '\u{1F468}‍\u{1F469}‍\u{1F467}'],
    ['ßtraße', 'ß'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %j', (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });

  it('works without Intl.Segmenter, a code point at a time', async () => {
    const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')!;
    expect(Reflect.deleteProperty(Intl, 'Segmenter')).toBe(true);
    try {
      vi.resetModules();
      const { initialOf: withoutSegmenter } = await import('./initial');
      expect(withoutSegmenter('binance')).toBe('B');
      expect(withoutSegmenter('\u{1F600} Tomás')).toBe('\u{1F600}');
      expect(withoutSegmenter(' ')).toBe('?');
      // The tell-tale of the fallback: half a flag, where a segmenter gives the whole one.
      expect(withoutSegmenter('\u{1F1E6}\u{1F1F7} Balanz')).toBe('\u{1F1E6}');
    } finally {
      Object.defineProperty(Intl, 'Segmenter', segmenter);
    }
  });
});
