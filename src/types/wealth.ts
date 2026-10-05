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

export interface NetWorth {
  usd: number;
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

export type MovementKind = 'OPENING' | 'CLOSING' | 'GAIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'ADJUSTMENT';

/** A holding as a movement remembers it, and whether it still exists. */
export interface MovementHolding {
  id: string;
  name: string;
  platform: string;
  assetClass: string;
  exists: boolean;
}

/** One recorded change of value (GET /movements). */
export interface Movement {
  id: string;
  kind: MovementKind;
  occurredAt: string;
  createdAt: string;
  amountUsd: number;
  feeUsd: number | null;
  /** The holding it's about; for a transfer, where the money left. */
  holding: MovementHolding | null;
  /** A transfer's destination. */
  toHolding: MovementHolding | null;
  previousValueUsd: number | null;
  newValueUsd: number | null;
  note: string | null;
  revertible: boolean;
}

export interface MovementPage {
  items: Movement[];
  nextCursor: string | null;
}

/** What an edit of a holding's value was: a gain or loss, money in or out, or a correction. */
export type ValueChangeReason = 'MARKET' | 'CASH_FLOW' | 'CORRECTION';

export type ViewType = 'dashboard' | 'platforms' | 'assets' | 'estimate' | 'history';

export interface EstimateParams {
  contribution: number;
  yieldPct: number;
  years: number;
}
