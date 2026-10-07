import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  approximateGraphemes,
  base64url,
  byName,
  classIdOf,
  contrastRatio,
  fromBase64url,
  graphemeCount,
  isHexColor,
  normalizeAvatar,
  PALETTE,
  platformIdOf,
  validAvatar,
} from './customization';

describe('contrastRatio', () => {
  it("measures WCAG 2's contrast, of hex colors and of the design tokens", () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(contrastRatio('#ffffff', '#767676')).toBeCloseTo(4.54, 2);
    // oklch(1 0 0) is white, oklch(0 0 0) black; percentages and hues work too.
    expect(contrastRatio('oklch(1 0 0)', '#000000')).toBeCloseTo(21, 3);
    expect(contrastRatio('oklch(0% 0 0)', '#ffffff')).toBeCloseTo(21, 3);
    expect(contrastRatio('oklch(0.70 0.15 195)', '#ffffff')!).toBeLessThan(3); // the accent, under white letters
    expect(contrastRatio('oklch(0.70 0.15 195)', '#000000')!).toBeGreaterThan(7);
    // lab(), as the build ships the tokens: L 100 is white, 0 black.
    expect(contrastRatio('lab(100% 0 0)', '#000000')).toBeCloseTo(21, 3);
    expect(contrastRatio('lab(5 0 0)', '#000000')).toBeCloseTo(1.11, 2);
    expect(contrastRatio('lab(60.5306% 46.7177 -29.0512)', '#00c0c2')!).toBeLessThan(3);
    expect(contrastRatio('var(--x)', '#000000')).toBeNull();
    expect(contrastRatio('#000000', '')).toBeNull();
  });
});

describe('customization rules (as the API has them)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['', 0],
    ['A', 1],
    ['AB', 2],
    ['é', 1],
    ['🟡', 1],
    ['👍🏽', 1],
    ['👨‍👩‍👧', 1],
    ['🇦🇷', 1],
    ['🇦🇷🇧🇷', 2],
    ['1️⃣', 1],
    ['❤️', 1],
    ['B🟡', 2],
  ])('counts %s as %i characters, with Intl.Segmenter and without', (text, n) => {
    expect(graphemeCount(text)).toBe(n);
    expect(approximateGraphemes(text)).toBe(n);
  });

  it('counts a lone mark or joiner as something', () => {
    expect(approximateGraphemes('́')).toBe(1);
    expect(approximateGraphemes('‍')).toBe(1);
  });

  it('takes 1 or 2 characters for a thumbnail, without the spaces around them', () => {
    for (const ok of ['B', ' bn ', '🟡', '🇦🇷', 'é']) expect(validAvatar(ok)).toBe(true);
    for (const bad of ['', '  ', 'ABC', '🟡🟡🟡']) expect(validAvatar(bad)).toBe(false);
    expect(normalizeAvatar(' é ')).toBe('é');
  });

  it('knows a hex color', () => {
    expect(isHexColor('#A1b2C3')).toBe(true);
    for (const bad of ['', 'a1b2c3', '#a1b2c', '#a1b2c3d', '#gggggg', 'red']) expect(isHexColor(bad)).toBe(false);
    expect(PALETTE).toHaveLength(12);
    expect(PALETTE.every((c) => isHexColor(c.hex))).toBe(true);
  });

  it('names classes and platforms as the API does (base64url, no padding)', () => {
    expect(classIdOf('Fixed Income')).toBe('Rml4ZWQgSW5jb21l');
    expect(classIdOf(' Crypto ')).toBe('Q3J5cHRv');
    expect(platformIdOf('BINANCE')).toBe(platformIdOf('binance'));
    expect(base64url('ÿÿ?')).toBe('w7_Dvz8');
    expect(fromBase64url('w7_Dvz8')).toBe('ÿÿ?');
    expect(fromBase64url(base64url('🟡 Café'))).toBe('🟡 Café');
    expect(fromBase64url('%%%')).toBeNull();
    expect(fromBase64url('_w')).toBeNull(); // not UTF-8
  });

  it('orders names as a person reads them', () => {
    expect(['zurich', 'Álamo', 'alamo', 'Beta'].sort(byName)).toEqual(['alamo', 'Álamo', 'Beta', 'zurich']);
    expect(byName('a', 'a')).toBe(0);
  });

  it('falls back to its own count without Intl.Segmenter', async () => {
    vi.resetModules();
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
    const fresh = await import('./customization');
    expect(fresh.graphemeCount('👨‍👩‍👧B')).toBe(2);
  });
});
