import type { Snapshot } from '@/types/wealth';

// History's periods of analysis: the range each one covers (in the browser's time zone), the points of the
// net worth in it, and what they say: the change, annualized, the high and low, the worst drop from a high,
// and the best and worst stretch between two checkpoints.

export type PeriodPreset = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | 'ALL' | 'CUSTOM';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: '3Y', label: '3Y' },
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const DEFAULT_PERIOD: PeriodPreset = '1Y';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS: Partial<Record<PeriodPreset, number>> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36 };

export interface Period {
  /** Its first instant; null for all time. */
  from: Date | null;
  /** Its last instant. */
  to: Date;
  /** Whether it runs until now, so today's value belongs in it. */
  untilNow: boolean;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** The same day `months` months before, at midnight: the month's last day when it has no such day (Mar 31 → Feb 28). */
export function monthsBefore(d: Date, months: number): Date {
  const [year, month, day] = [d.getFullYear(), d.getMonth() - months, d.getDate()];
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** A date input's value (YYYY-MM-DD) as that day's local midnight; null if it isn't a real date. */
export function localDay(text: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** What's wrong with a custom period's dates, if anything. */
export function customProblem(from: string, to: string, now: Date): string | undefined {
  const [start, end] = [localDay(from), localDay(to)];
  if (!start || !end) return 'Pick both dates';
  if (end < start) return "The end can't be before the start";
  if (end > startOfDay(now)) return "The end can't be in the future";
  return undefined;
}

/** The range a preset covers: until now, from the same day 1, 3, 6, 12 or 36 months back, January 1st, or ever. */
export function periodOf(preset: PeriodPreset, now: Date, custom?: { from: string; to: string }): Period {
  if (preset === 'CUSTOM' && custom && !customProblem(custom.from, custom.to, now)) {
    const end = localDay(custom.to)!;
    const untilNow = end.getTime() === startOfDay(now).getTime();
    return { from: localDay(custom.from)!, to: untilNow ? now : endOfDay(end), untilNow };
  }
  const months = MONTHS[preset];
  if (months) return { from: monthsBefore(startOfDay(now), months), to: now, untilNow: true };
  if (preset === 'YTD') return { from: new Date(now.getFullYear(), 0, 1), to: now, untilNow: true };
  return { from: null, to: now, untilNow: true };
}

/** One point of the net worth: a checkpoint, or today's value. */
export interface PeriodPoint {
  at: Date;
  value: number;
  assets: number;
  debts: number;
  /** The checkpoint it is; null for today's value. */
  snapshot: Snapshot | null;
}

export const pointOf = (s: Snapshot): PeriodPoint => ({
  at: new Date(s.capturedAt),
  value: s.totalValueUsd,
  assets: s.assetsUsd,
  debts: s.debtsUsd,
  snapshot: s,
});

const within = (at: Date, period: Period) => (!period.from || at >= period.from) && at <= period.to;

/** The period's checkpoints, in order, then today's value when the period runs until now and it's given. */
export function pointsIn(snapshots: Snapshot[], period: Period, today: PeriodPoint | null): PeriodPoint[] {
  const points = snapshots.map(pointOf).filter((p) => within(p.at, period));
  if (today && period.untilNow) points.push(today);
  return points;
}

/**
 * Where the period's change is measured from and to: from the latest checkpoint at or before its start (else
 * its first point), to its last point.
 */
export function periodEnds(snapshots: Snapshot[], period: Period, points: PeriodPoint[]) {
  const before = period.from ? snapshots.filter((s) => new Date(s.capturedAt) <= period.from!) : [];
  const start = before.length ? pointOf(before[before.length - 1]) : (points[0] ?? null);
  const end = points.at(-1) ?? null;
  return { start: end ? start : null, end };
}

/** A stretch between two points: how much it went up or down, in dollars and, from above zero, in %. */
export interface Stretch {
  from: PeriodPoint;
  to: PeriodPoint;
  usd: number;
  pct: number | null;
}

export interface PeriodStats {
  start: PeriodPoint;
  end: PeriodPoint;
  change: Stretch;
  days: number;
  /** (end / start)^(365.25 / days) − 1, in %: with 90 days or more, both above zero. It includes what was saved. */
  annualizedPct: number | null;
  high: PeriodPoint;
  low: PeriodPoint;
  /** The worst drop from an earlier high (null if it never dropped). */
  drawdown: Stretch | null;
  /** The best rise and the worst fall between two checkpoints in a row (null if none rose, or fell). */
  best: Stretch | null;
  worst: Stretch | null;
}

const stretch = (from: PeriodPoint, to: PeriodPoint): Stretch => ({
  from,
  to,
  usd: Math.round((to.value - from.value) * 100) / 100,
  pct: from.value > 0 ? ((to.value - from.value) / from.value) * 100 : null,
});

/** What the period's points say, from its start to its end (see periodEnds); null without both. */
export function periodStats(start: PeriodPoint | null, points: PeriodPoint[], end: PeriodPoint | null): PeriodStats | null {
  if (!start || !end) return null;
  // The start, when it's from before the period, opens the series (once: it may be the period's first point).
  const among = points.some((p) => p === start || (p.snapshot !== null && p.snapshot === start.snapshot));
  const series = among ? points : [start, ...points];
  const days = (end.at.getTime() - start.at.getTime()) / DAY_MS;
  const annualizedPct =
    days >= 90 && start.value > 0 && end.value > 0 ? ((end.value / start.value) ** (365.25 / days) - 1) * 100 : null;

  let high = series[0];
  let low = series[0];
  let peak = series[0];
  let drawdown: Stretch | null = null;
  let best: Stretch | null = null;
  let worst: Stretch | null = null;
  series.forEach((p, i) => {
    if (p.value > high.value) high = p;
    if (p.value < low.value) low = p;
    if (p.value > peak.value) peak = p;
    const drop = stretch(peak, p);
    if (drop.usd < 0 && (!drawdown || drop.usd < drawdown.usd)) drawdown = drop;
    if (i === 0) return;
    const step = stretch(series[i - 1], p);
    if (step.usd > 0 && (!best || step.usd > best.usd)) best = step;
    if (step.usd < 0 && (!worst || step.usd < worst.usd)) worst = step;
  });
  return { start, end, change: stretch(start, end), days, annualizedPct, high, low, drawdown, best, worst };
}

/** Labels for a time axis from `from` to `to`: `count` evenly spaced, the ends included. */
export function timeTicks(from: Date, to: Date, count = 4): { at: Date; label: string }[] {
  const span = to.getTime() - from.getTime();
  const days = span / DAY_MS;
  const format: Intl.DateTimeFormatOptions =
    days <= 120 ? { month: 'short', day: 'numeric' } : days <= 3 * 365 ? { month: 'short', year: 'numeric' } : { year: 'numeric' };
  const n = span > 0 ? count : 1;
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(from.getTime() + (n > 1 ? (span * i) / (n - 1) : 0));
    return { at, label: at.toLocaleDateString('en-US', format) };
  });
}

/** After how many days without a checkpoint History and the dashboard suggest saving one. */
export const REMINDER_DAYS = 30;

/**
 * Whether to suggest a snapshot: the last checkpoint is over 30 days old (days since it), or there's none yet
 * and there's something to record (days null). Undefined when there's nothing to suggest.
 */
export function snapshotReminder(snapshots: Snapshot[], holdingsCount: number, now: Date): { days: number | null } | undefined {
  const last = snapshots.at(-1);
  if (!last) return holdingsCount > 0 ? { days: null } : undefined;
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(new Date(last.capturedAt)).getTime()) / DAY_MS);
  return days > REMINDER_DAYS ? { days } : undefined;
}
