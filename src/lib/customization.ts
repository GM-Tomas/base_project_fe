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

/** The types offered for a platform; any other (up to 40 characters) is fine too. */
export const PLATFORM_TYPES = ['Bank', 'Broker', 'Exchange', 'Wallet', 'Other'];

export const COLOR_MESSAGE = 'color must be a hex color like #1a2b3c';
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
