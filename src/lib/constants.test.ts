import { describe, expect, it } from 'vitest';
import { assetClassColor, assetClassTag, platformColor, platformTag } from './constants';

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

  it('styles known asset classes and platform types, and falls back for the rest', () => {
    expect(assetClassColor('Equity')).toBe('var(--color-accent-500)');
    expect(assetClassTag('Equity')).toBe('tag tag-accent');
    expect(platformTag('Broker')).toBe('tag tag-accent');
    expect(assetClassColor('Art')).toBe('var(--color-neutral-400)');
    expect(assetClassTag('Art')).toBe('tag tag-neutral');
    expect(platformTag('Other')).toBe('tag tag-neutral');
  });

  it('treats user-typed labels as plain text, never as object keys like "constructor"', () => {
    for (const label of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(assetClassColor(label)).toBe('var(--color-neutral-400)');
      expect(assetClassTag(label)).toBe('tag tag-neutral');
      expect(platformTag(label)).toBe('tag tag-neutral');
      expect(platformColor(label)).toMatch(/^var\(--color-/);
    }
  });
});
