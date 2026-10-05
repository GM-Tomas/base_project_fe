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

/** Assets minus debts: below zero when more is owed than owned. */
export interface NetWorth {
  usd: number;
}

export interface DebtTotals {
  usd: number;
  count: number;
  monthlyPaymentUsd: number;
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
  assets: { usd: number };
  debts: DebtTotals;
  holdingsCount: number;
  ytd: Ytd;
  liquidity: Liquidity;
  byAssetClass: AssetClassBreakdown[];
  byPlatform: PlatformBreakdown[];
}

/** A net worth at a moment: totalValueUsd is assetsUsd − debtsUsd. */
export interface Snapshot {
  id: string;
  capturedAt: string;
  totalValueUsd: number;
  assetsUsd: number;
  debtsUsd: number;
  changePctFromPrevious: number | null;
}

export interface ProjectionPoint {
  year: number;
  /** The portfolio's. */
  futureValueUsd: number;
  totalContributedUsd: number;
  interestEarnedUsd: number;
  /** What's still owed then. */
  debtBalanceUsd: number;
  netWorthUsd: number;
}

export type MilestoneStatus = 'ACHIEVED' | 'REACHABLE' | 'OUT_OF_HORIZON';

export interface Milestone {
  amountUsd: number;
  status: MilestoneStatus;
  monthsRequired: number | null;
  targetMonth: string | null;
}

export interface Projection {
  /** The portfolio (assets) the projection grows. */
  principalUsd: number;
  /** What's owed now. */
  debtsUsd: number;
  monthlyContributionUsd: number;
  annualYieldPct: number;
  years: number;
  series: ProjectionPoint[];
  milestones: Milestone[];
}

export type MovementKind =
  | 'OPENING'
  | 'CLOSING'
  | 'GAIN'
  | 'LOSS'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'DEBT_PAYMENT'
  | 'DEBT_CHARGE'
  | 'DEBT_INTEREST';

/** A holding as a movement remembers it, and whether it still exists. */
export interface MovementHolding {
  id: string;
  name: string;
  platform: string;
  assetClass: string;
  exists: boolean;
}

/** A debt as a movement remembers it, and whether it still exists. */
export interface MovementDebt {
  id: string;
  name: string;
  lender: string | null;
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
  /** The holding it's about; for a transfer or a debt payment, where the money left. */
  holding: MovementHolding | null;
  /** Where the money arrived: a transfer's destination, the holding a debt charge went into. */
  toHolding: MovementHolding | null;
  /** The debt it's about: its payments, charges and interest, and its opening, closing or correction. */
  debt: MovementDebt | null;
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

export type DebtKind = 'CREDIT_CARD' | 'LOAN' | 'MORTGAGE' | 'PERSONAL' | 'OTHER';

export type PayoffStatus = 'PAID_OFF' | 'ON_TRACK' | 'NEVER' | 'NO_PAYMENT';

/** When a debt is paid off at its monthly payment; months, payoffMonth and totalInterestUsd come with ON_TRACK. */
export interface DebtPayoff {
  status: PayoffStatus;
  months: number | null;
  /** YYYY-MM */
  payoffMonth: string | null;
  totalInterestUsd: number | null;
}

export interface Debt {
  id: string;
  name: string;
  lender: string | null;
  kind: DebtKind;
  /** What's left to pay. */
  balanceUsd: number;
  interestRatePct: number | null;
  monthlyPaymentUsd: number | null;
  dueDay: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  payoff: DebtPayoff;
}

/** What an edit of a debt's balance was. */
export type BalanceChangeReason = 'PAYMENT' | 'CHARGE' | 'INTEREST' | 'CORRECTION';

export type ViewType = 'dashboard' | 'platforms' | 'assets' | 'debts' | 'estimate' | 'history';

export interface EstimateParams {
  contribution: number;
  yieldPct: number;
  years: number;
}
