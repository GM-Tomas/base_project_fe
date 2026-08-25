export type AssetClass = string;

export type PlatformType = string;

export interface Holding {
  id: string;
  name: string;
  assetClass: AssetClass;
  platform: string;
  valueUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface Platform {
  name: string;
  type: PlatformType;
  createdAt: string;
}

export interface AvailableAssetClasses {
  defaults: string[];
  inUse: string[];
  all: string[];
}

export interface FxRate {
  available: boolean;
  value?: number;
  asOf?: string;
  source?: string;
}

export interface NetWorth {
  usd: number;
  ars: number | null;
  fxRate: FxRate;
}

export type YtdBasis = 'YEAR_START_SNAPSHOT' | 'EARLIEST_SNAPSHOT' | 'NO_BASELINE';

export interface Ytd {
  basis: YtdBasis;
  growthPct: number;
  baselineValueUsd?: number;
  baselineAt?: string;
}

export interface Liquidity {
  liquidPct: number;
  illiquidPct: number;
  liquidAssetClasses: string[];
}

export interface AssetClassBreakdown {
  assetClass: string;
  valueUsd: number;
  pct: number;
  count: number;
}

export interface PlatformBreakdown {
  name: string;
  type: string;
  valueUsd: number;
  pct: number;
  count: number;
}

export interface WealthSummary {
  netWorth: NetWorth;
  holdingsCount: number;
  ytd: Ytd;
  liquidity: Liquidity;
  byAssetClass: AssetClassBreakdown[];
  byPlatform: PlatformBreakdown[];
}

export interface Snapshot {
  id: string;
  capturedAt: string;
  totalValueUsd: number;
  changePctFromPrevious: number | null;
}

export interface ProjectionPoint {
  year: number;
  futureValueUsd: number;
  totalContributedUsd: number;
  interestEarnedUsd: number;
}

export type MilestoneStatus = 'ACHIEVED' | 'REACHABLE' | 'OUT_OF_HORIZON';

export interface Milestone {
  amountUsd: number;
  status: MilestoneStatus;
  monthsRequired: number | null;
  targetMonth: string | null;
}

export interface Projection {
  principalUsd: number;
  monthlyContributionUsd: number;
  annualYieldPct: number;
  years: number;
  series: ProjectionPoint[];
  milestones: Milestone[];
}

export type ViewType = 'dashboard' | 'platforms' | 'assets' | 'estimate' | 'history';

export interface EstimateParams {
  contribution: number;
  yieldPct: number;
  years: number;
}
