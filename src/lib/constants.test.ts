import { describe, expect, it } from 'vitest';
import { assetClassColor, platformColor } from './constants';

describe('label colors and tags', () => {
  it('keeps the named colors and gives every other platform a stable palette color', () => {
    expect(platformColor('Binance')).toBe('var(--color-accent-2-500)');

    const color = platformColor('Bob Bank');
    expect(color).toMatch(/^var\(--color-/);
    expect(platformColor('Bob Bank')).toBe(color);

    // Spread over the palette, not one grey for every account's own platforms.
    const colors = new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map(platformColor));
    expect(colors.size).toBeGreaterThan(3);
  });

  it('colors known asset classes, and falls back for the rest', () => {
    expect(assetClassColor('Equity')).toBe('var(--color-accent-500)');
    expect(assetClassColor('Art')).toBe('var(--color-neutral-400)');
  });

  it('treats user-typed labels as plain text, never as object keys like "constructor"', () => {
    for (const label of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(assetClassColor(label)).toBe('var(--color-neutral-400)');
      expect(platformColor(label)).toMatch(/^var\(--color-/);
    }
  });
});
