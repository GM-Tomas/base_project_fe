import { AssetClass } from '@/types/wealth';

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  Cash: 'var(--color-accent-300)',
  'Fixed Income': 'var(--color-neutral-500)',
  'Index Fund': 'var(--color-neutral-300)',
  Equity: 'var(--color-accent-500)',
  Crypto: 'var(--color-accent-2-500)',
};

export const ASSET_CLASS_TAG_CLASSES: Record<AssetClass, string> = {
  Cash: 'tag tag-outline',
  'Fixed Income': 'tag tag-neutral',
  'Index Fund': 'tag tag-neutral',
  Equity: 'tag tag-accent',
  Crypto: 'tag tag-accent-2',
};

export const PLATFORM_COLORS: Record<string, string> = {
  Balanz: 'var(--color-accent-500)',
  'Mercado Pago': 'var(--color-neutral-300)',
  'Banco Galicia': 'var(--color-neutral-500)',
  Nexo: 'var(--color-accent-2-300)',
  Binance: 'var(--color-accent-2-500)',
};

export const PLATFORM_TAG_CLASSES: Record<string, string> = {
  Broker: 'tag tag-accent',
  Wallet: 'tag tag-neutral',
  Bank: 'tag tag-neutral',
  Exchange: 'tag tag-accent-2',
};
