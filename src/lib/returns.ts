import type { ExpectedReturn, Holding } from '@/types/wealth';
import { formatNumber } from './calculations';
import { messages } from './i18n';

// Expected yearly returns: each holding's (as the API keeps them: -100 to 100, 2 decimals), the portfolio's
// (weighted by value, as the API works it out: base_project_go domain/service.CalculateExpectedReturn) and
// what each class and holding adds to it.

export const MAX_RETURN_PCT = 100;
export const RETURN_RANGE = 'expectedReturnPct must be between -100 and 100';

/**
 * Rounded half away from zero, as the API rounds: on the number as written (1.005 is 1.01), which is what it
 * reads from JSON, not on its binary value (a hair under 1.005).
 */
export function roundTo(v: number, places: number): number {
  const shift = (n: number, by: number) => {
    const [digits, exponent = '0'] = String(n).split('e');
    return Number(`${digits}e${Number(exponent) + by}`);
  };
  const rounded = shift(Math.round(shift(Math.abs(v), places)), -places);
  return v < 0 && rounded !== 0 ? -rounded : rounded;
}

/** Rounded to 2 decimals, as the API keeps percentages. */
export const round2 = (v: number) => roundTo(v, 2);
const round1 = (v: number) => roundTo(v, 1);

/** Whether the API takes a yearly return (it keeps 2 decimals, so 100.004 is 100). */
export const validReturn = (v: number) => Number.isFinite(v) && Math.abs(round2(v)) <= MAX_RETURN_PCT;

type Weighable = Pick<Holding, 'valueUsd' | 'effectiveReturnPct'>;

/** The portfolio's expected return: Σ(valueᵢ × returnᵢ) / Σ valueᵢ, those without one counting as 0%. */
export function expectedReturnOf(holdings: Weighable[]): ExpectedReturn {
  let total = 0;
  let weighted = 0;
  let covered = 0;
  for (const h of holdings) {
    total += h.valueUsd;
    if (h.effectiveReturnPct !== null) {
      weighted += h.valueUsd * h.effectiveReturnPct;
      covered += h.valueUsd;
    }
  }
  if (total <= 0) return { weightedPct: null, coveragePct: 0, annualUsd: 0 };
  return {
    weightedPct: round2(weighted / total),
    coveragePct: round1((covered * 100) / total),
    annualUsd: round2(weighted / 100),
  };
}

export interface ReturnShare {
  name: string;
  valueUsd: number;
  /** What it adds to the portfolio's return, in percentage points: value × return / total. */
  points: number;
  /** Its own return (a class's: weighted by value); null when none of it has one. */
  returnPct: number | null;
}

const byPoints = (a: ReturnShare, b: ReturnShare) => b.points - a.points || b.valueUsd - a.valueUsd || a.name.localeCompare(b.name);

/** What each class and each holding adds to the portfolio's return, largest first. */
export function returnShares(holdings: Pick<Holding, 'name' | 'assetClass' | 'valueUsd' | 'effectiveReturnPct'>[]) {
  const total = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
  const points = (valueTimesReturn: number) => (total > 0 ? valueTimesReturn / total : 0);
  const byAsset: ReturnShare[] = holdings.map((h) => ({
    name: h.name,
    valueUsd: h.valueUsd,
    points: points(h.valueUsd * (h.effectiveReturnPct ?? 0)),
    returnPct: h.effectiveReturnPct,
  }));
  const classes = new Map<string, { value: number; weighted: number; covered: number }>();
  for (const h of holdings) {
    const c = classes.get(h.assetClass) ?? { value: 0, weighted: 0, covered: 0 };
    c.value += h.valueUsd;
    if (h.effectiveReturnPct !== null) {
      c.weighted += h.valueUsd * h.effectiveReturnPct;
      c.covered += h.valueUsd;
    }
    classes.set(h.assetClass, c);
  }
  const byClass: ReturnShare[] = [...classes].map(([name, c]) => ({
    name,
    valueUsd: c.value,
    points: points(c.weighted),
    returnPct: c.covered > 0 && c.value > 0 ? round2(c.weighted / c.value) : null,
  }));
  return { byClass: byClass.sort(byPoints), byAsset: byAsset.sort(byPoints) };
}

/** "7.8%", "-2.5%", "12%": a yearly return in a few characters. */
export const formatReturn = (pct: number, digits = 1) => `${formatNumber(pct, digits)}%`;

export type ParsedPercent = { value: number | null; error?: undefined } | { value?: undefined; error: string };

/**
 * A percentage as people type it: "7.5", "7,5", "-3", "12 %"; empty is none. Kept to 2 decimals, within
 * [min, max].
 */
export function parsePercent(raw: string, { min = -MAX_RETURN_PCT, max = MAX_RETURN_PCT } = {}): ParsedPercent {
  const text = raw.replace(/\s|%/g, '').replace(/^−/, '-');
  if (!text) return { value: null };
  const decimal = text.includes('.') ? text : text.replace(',', '.');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(decimal)) return { error: messages().percent.hint };
  const value = round2(Number(decimal));
  if (value < min || value > max) return { error: messages().percent.between(min, max) };
  return { value: Object.is(value, -0) ? 0 : value };
}
