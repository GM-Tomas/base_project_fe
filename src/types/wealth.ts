export type AssetClass = string;

export type PlatformType = string;

export interface Holding {
  id: string;
  name: string;
  assetClass: AssetClass;
  platform: string;
  valueUsd: number;
  /** Roughly how much it grows in a year (%), if the user said. */
  expectedReturnPct: number | null;
  /** The yearly return it counts with in the portfolio's: its own, or else its class's default one. */
  effectiveReturnPct: number | null;
  createdAt: string;
  updatedAt: string;
}

/** One of the user's platforms (a name their holdings use), as they set it up. */
export interface Platform {
  /** What the API names it with in its paths. */
  id: string;
  name: string;
  type: PlatformType;
  /** What its thumbnail shows (1 or 2 characters, an emoji counting as one); null: its initial. */
  avatarText: string | null;
  /** #rrggbb; null: a color picked from its name. */
  color: string | null;
  holdingsCount: number;
  valueUsd: number;
  createdAt: string;
}

/** One of the user's asset classes, as they set it up. */
export interface AssetClassInfo {
  /** What the API names it with in its paths. */
  id: string;
  name: string;
  /** #rrggbb; null: its default color. */
  color: string | null;
  /** Whether it counts as ready to spend. */
  liquid: boolean;
  /** The yearly return its holdings without one of their own count with. */
  expectedReturnPct: number | null;
  /** One of the classes every account starts with. */
  isDefault: boolean;
  holdingsCount: number;
  valueUsd: number;
}

export interface AvailableAssetClasses {
  defaults: string[];
  inUse: string[];
  /** The user's classes, in the order they're offered. */
  all: string[];
  /** The same, each with how it's set up. */
  classes: AssetClassInfo[];
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
  /** The user's color for it (null: the default one). */
  color: string | null;
  liquid: boolean;
}

export interface PlatformBreakdown {
  name: string;
  type: string;
  valueUsd: number;
  pct: number;
  count: number;
  /** Its thumbnail, as the user set it (null: the default). */
  avatarText: string | null;
  color: string | null;
}

/** What the portfolio is expected to earn in a year: each holding's return weighted by its value. */
export interface ExpectedReturn {
  /** Null with nothing to weigh (no holdings, or all worth 0). Holdings without a return count as 0%. */
  weightedPct: number | null;
  /** The share of the portfolio's value with a return set. */
  coveragePct: number;
  annualUsd: number;
}

export interface WealthSummary {
  netWorth: NetWorth;
  assets: { usd: number };
  debts: DebtTotals;
  holdingsCount: number;
  expectedReturn: ExpectedReturn;
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
  /** AUTO: the net worth when it was taken; MANUAL: one from the past the user entered. */
  source: 'AUTO' | 'MANUAL';
  note: string | null;
}

/** Where a period's movements count (GET /movements/summary). */
export type SummaryBucket =
  | 'GAIN'
  | 'LOSS'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'TRANSFER_FEES'
  | 'OPENING'
  | 'CLOSING'
  | 'ADJUSTMENT'
  | 'DEBT_OPENING'
  | 'DEBT_CLOSING'
  | 'DEBT_PAYMENT_EXTERNAL'
  | 'DEBT_PAYMENT_FROM_ASSET'
  | 'DEBT_CHARGE_EXTERNAL'
  | 'DEBT_CHARGE_TO_ASSET'
  | 'DEBT_INTEREST';

/** A period's change of net worth as its movements explain it, by why. */
export interface NetWorthEffect {
  /** Gains − losses − transfer fees − interest on debts. */
  investments: number;
  /** Deposits − withdrawals ± debt payments and charges with money from outside. */
  saving: number;
  /** Assets added − removed + debts closed − opened. */
  addedRemoved: number;
  corrections: number;
}

/** What a period's movements add up to. */
export interface MovementsSummary {
  from: string;
  to: string;
  count: number;
  /** Moves between what's owned and owed: they leave the net worth as it was (but a transfer's fee). */
  transfers: number;
  totalsUsd: Record<SummaryBucket, number>;
  netWorthEffectUsd: NetWorthEffect;
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
  /** The same two in today's dollars (deflated at the inflation asked; as above without one). */
  realFutureValueUsd: number;
  realNetWorthUsd: number;
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
  /** The growth used: the portfolio's expected return (PORTFOLIO) or the one asked for (CUSTOM). */
  annualYieldPct: number;
  yieldSource: YieldMode;
  /** The portfolio's expected return either way; null with nothing to weigh. */
  portfolioYieldPct: number | null;
  inflationPct: number;
  contributionGrowthPct: number;
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

export type ViewType = 'dashboard' | 'platforms' | 'assets' | 'debts' | 'estimate' | 'history' | 'settings';

/** How Estimate picks the yearly growth: the portfolio's expected return, or the user's own. */
export type YieldMode = 'PORTFOLIO' | 'CUSTOM';

/** Estimate as the user left it (saved in the backend, for every device). */
export interface EstimatePreferences {
  contributionUsd: number;
  years: number;
  yieldMode: YieldMode;
  customYieldPct: number;
  /** In order, at most 5. */
  milestonesUsd: number[];
  inflationPct: number;
  contributionGrowthPct: number;
}

export interface Preferences {
  estimate: EstimatePreferences;
}

/** GET /wealth/estimate: without yieldPct, the portfolio's expected return. */
export interface EstimateQuery {
  contribution: number;
  years: number;
  yieldPct?: number;
  milestones?: number[];
  inflationPct?: number;
  contributionGrowthPct?: number;
}
