export type AssetClass = string;

export type PlatformType = string;

export interface Holding {
  id: number | string;
  name: string;
  cls: AssetClass;
  platform: string;
  value: number; // Stored in USD
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
