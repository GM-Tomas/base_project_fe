import { normalizeLabel, platformKey } from './labels';

// How the user sets up their classes and platforms: the API's rules and messages (base_project_go: the
// model's customization, color and grapheme rules, AssetClassHandler and PlatformHandler).

export const MAX_CLASS_NAME = 60;
export const MAX_PLATFORM_NAME = 120;
export const MAX_PLATFORM_TYPE = 40;
/** Classes a user can create or set up. */
export const MAX_CLASS_SETTINGS = 100;
/** Platforms a user can customize. */
export const MAX_PLATFORM_SETTINGS = 1000;


export const COLOR_MESSAGE = 'color must be a hex color like #1a2b3c';
export const TEXT_COLOR_MESSAGE = 'textColor must be a hex color like #1a2b3c';
export const AVATAR_MESSAGE = 'avatarText must be 1 or 2 characters (an emoji counts as one)';

/** The design system's colors, as the API keeps them (#rrggbb): its accents, then the hues around them. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: 'Teal', hex: '#00c0c2' },
  { name: 'Sky', hex: '#3bb9ed' },
  { name: 'Blue', hex: '#5f97f4' },
  { name: 'Violet', hex: '#9b79ee' },
  { name: 'Magenta', hex: '#cf6ec8' },
  { name: 'Rose', hex: '#eb648a' },
  { name: 'Red', hex: '#ec5c52' },
  { name: 'Orange', hex: '#f28e42' },
  { name: 'Amber', hex: '#e7b643' },
  { name: 'Lime', hex: '#a6cf51' },
  { name: 'Green', hex: '#58c66e' },
  { name: 'Slate', hex: '#828e95' },
];

export const isHexColor = (text: string) => /^#[0-9a-fA-F]{6}$/.test(text);

/**
 * A color's relative luminance (WCAG 2), from #rrggbb, or oklch(L C H) as the design tokens are written, or
 * lab(L a b) as the build ships them; null otherwise.
 */
export function luminance(color: string): number | null {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  const ok = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(color.trim());
  const lab = /^lab\(\s*([\d.]+)%?\s/i.exec(color.trim());
  // CIELAB's lightness is luminance, perceptually scaled.
  if (lab) return +lab[1] > 8 ? ((+lab[1] + 16) / 116) ** 3 : +lab[1] / 903.3;
  let rgb: number[];
  if (hex) {
    rgb = hex.slice(1).map((h) => {
      const c = parseInt(h, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  } else if (ok) {
    // OKLCH → OKLab → linear sRGB (Björn Ottosson's matrices), clipped to the gamut.
    const L = +ok[1] / (ok[2] ? 100 : 1);
    const a = +ok[3] * Math.cos((+ok[4] * Math.PI) / 180);
    const b = +ok[3] * Math.sin((+ok[4] * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((v) => Math.min(1, Math.max(0, v)));
  } else {
    return null;
  }
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** WCAG 2 contrast between two colors, 1 to 21; null if either can't be read. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// One segmenter for every call, made on first use (see initial.ts).
let segmenter: Intl.Segmenter | null | undefined;

/**
 * How many characters a person sees: a flag, an emoji with its skin tone or joined into a family, a letter
 * with its accent are one each. Without Intl.Segmenter, the API's own rules.
 */
export function graphemeCount(text: string): number {
  if (segmenter === undefined) segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
  if (segmenter) return [...segmenter.segment(text)].length;
  return approximateGraphemes(text);
}

// The API's count (model.GraphemeCount): marks, variation selectors, skin tones, keycaps and tags join the
// character before them, a zero-width joiner joins the next one, two regional indicators make one flag.
export function approximateGraphemes(text: string): number {
  let count = 0;
  let joined = false;
  let pendingFlag = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const extends_ =
      /\p{M}/u.test(ch) || cp === 0xfe0e || cp === 0xfe0f || cp === 0x20e3 || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0020 && cp <= 0xe007f);
    if (extends_) {
      if (count === 0) count = 1;
    } else if (cp === 0x200d) {
      joined = true;
      if (count === 0) count = 1;
    } else if (joined) {
      joined = false;
    } else if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
      if (pendingFlag) {
        pendingFlag = false;
        continue;
      }
      pendingFlag = true;
      count++;
    } else {
      pendingFlag = false;
      count++;
    }
  }
  return count;
}

/** A thumbnail's text as the API keeps it: without the spaces around it, in NFC. */
export const normalizeAvatar = (text: string) => text.trim().normalize('NFC');

/** Whether the API takes this thumbnail text: 1 or 2 characters, an emoji counting as one. */
export const validAvatar = (text: string) => {
  const n = graphemeCount(normalizeAvatar(text));
  return n >= 1 && n <= 2;
};

/** base64url without padding, of the UTF-8 bytes. */
export function base64url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The text a base64url id stands for, if it's one. */
export function fromBase64url(id: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(id)) return null;
  try {
    const binary = atob(id.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** How the API names a class in its paths: its name, base64url. */
export const classIdOf = (name: string) => base64url(normalizeLabel(name));

/** How the API names a platform in its paths: what makes two names the same platform, base64url. */
export const platformIdOf = (name: string) => base64url(platformKey(name));

/** Names in the order a person reads them: case and accents aside, ties by how they're written. */
export const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
