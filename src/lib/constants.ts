import { Holding, PlatformMeta, HistorySnapshot, AssetClass } from '@/types/wealth';

export const INITIAL_HOLDINGS: Holding[] = [
  { id: 1, name: 'Cuenta remunerada ARS', cls: 'Cash', platform: 'Mercado Pago', qty: null, value: 6150 },
  { id: 2, name: 'Plazo fijo UVA 90d', cls: 'Fixed Income', platform: 'Banco Galicia', qty: null, value: 11300 },
  { id: 3, name: 'AL30D Bonar 2030', cls: 'Fixed Income', platform: 'Balanz', qty: null, value: 9100 },
  { id: 4, name: 'S&P 500 Index Fund', cls: 'Index Fund', platform: 'Balanz', qty: 42, value: 5100 },
  { id: 5, name: 'AAPL', cls: 'Equity', platform: 'Balanz', qty: 34, value: 7643 },
  { id: 6, name: 'NVDA', cls: 'Equity', platform: 'Balanz', qty: 8, value: 10557 },
  { id: 7, name: 'Bitcoin', cls: 'Crypto', platform: 'Nexo', qty: 0.098, value: 9200 },
  { id: 8, name: 'Ethereum', cls: 'Crypto', platform: 'Nexo', qty: 1.62, value: 5580 },
  { id: 9, name: 'Bitcoin', cls: 'Crypto', platform: 'Binance', qty: 0.145, value: 13616 },
  { id: 10, name: 'USDT (stable)', cls: 'Cash', platform: 'Binance', qty: 6004, value: 6004 },
];

export const INITIAL_PLATFORMS: PlatformMeta[] = [
  { name: 'Balanz', type: 'Broker' },
  { name: 'Mercado Pago', type: 'Wallet' },
  { name: 'Banco Galicia', type: 'Bank' },
  { name: 'Nexo', type: 'Exchange' },
  { name: 'Binance', type: 'Exchange' },
];

export const INITIAL_HISTORY: HistorySnapshot[] = [
  { m: 'Jan', v: 61200 },
  { m: 'Feb', v: 64800 },
  { m: 'Mar', v: 68950 },
  { m: 'Apr', v: 66300 },
  { m: 'May', v: 73100 },
  { m: 'Jun', v: 76800 },
  { m: 'Jul', v: 79400 },
  { m: 'Aug', v: 84250 },
];

export const ASSET_CLASS_OPTIONS: AssetClass[] = ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'];

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
