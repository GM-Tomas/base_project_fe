const ASSET_CLASS_COLORS: Record<string, string> = {
  Cash: 'var(--color-accent-300)',
  'Fixed Income': 'var(--color-neutral-500)',
  'Index Fund': 'var(--color-neutral-300)',
  Equity: 'var(--color-accent-500)',
  Crypto: 'var(--color-accent-2-500)',
};

const PLATFORM_COLORS: Record<string, string> = {
  Balanz: 'var(--color-accent-500)',
  'Mercado Pago': 'var(--color-neutral-300)',
  'Banco Galicia': 'var(--color-neutral-500)',
  Nexo: 'var(--color-accent-2-300)',
  Binance: 'var(--color-accent-2-500)',
};

const PLATFORM_PALETTE = [
  'var(--color-accent-500)',
  'var(--color-accent-2-500)',
  'var(--color-neutral-300)',
  'var(--color-accent-300)',
  'var(--color-accent-2-300)',
  'var(--color-neutral-500)',
  'var(--color-accent-400)',
  'var(--color-accent-2-400)',
];

// Labels are typed by users: an asset class called "constructor" must not pick up Object.prototype members.
const own = (map: Record<string, string>, key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export const assetClassColor = (assetClass: string) => own(ASSET_CLASS_COLORS, assetClass) ?? 'var(--color-neutral-400)';

// Every account names its own platforms, so beyond the few above each name gets a stable palette color
// (same name, same color, on every render and for every user) instead of all turning grey.
export function platformColor(name: string): string {
  const named = own(PLATFORM_COLORS, name);
  if (named) return named;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return PLATFORM_PALETTE[hash % PLATFORM_PALETTE.length];
}
