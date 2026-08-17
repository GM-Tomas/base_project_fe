export type AssetClass = 'Cash' | 'Fixed Income' | 'Index Fund' | 'Equity' | 'Crypto';

export type PlatformType = 'Broker' | 'Wallet' | 'Bank' | 'Exchange';

export type Currency = 'USD' | 'ARS' | 'BTC' | 'ETH' | 'USDT';

export interface Holding {
  id: number | string;
  name: string;
  cls: AssetClass;
  platform: string;
  qty: number | null;
  value: number; // Stored in base currency (USD)
  currency: Currency;
  change: number; // 24h change in %
}

export interface PlatformMeta {
  name: string;
  type: PlatformType;
}

export interface HistorySnapshot {
  m: string;
  v: number;
}

export type ViewType = 'dashboard' | 'platforms' | 'assets' | 'estimate' | 'history';

export interface EstimateParams {
  contribution: number;
  yieldPct: number;
  years: number;
}
