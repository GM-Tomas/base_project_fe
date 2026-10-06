import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@/types/wealth';
import {
  customProblem,
  localDay,
  monthsBefore,
  periodEnds,
  periodOf,
  periodStats,
  pointOf,
  pointsIn,
  snapshotReminder,
  timeTicks,
  type PeriodPoint,
} from './periods';

// Local times: the tests run in the machine's zone, as periods are computed.
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const snap = (id: string, at: Date, value: number): Snapshot => ({
  id, capturedAt: at.toISOString(), totalValueUsd: value, assetsUsd: Math.max(value, 0), debtsUsd: Math.max(-value, 0),
  changePctFromPrevious: null, source: 'AUTO', note: null,
});
const today = (at: Date, value: number): PeriodPoint => ({ at, value, assets: value, debts: 0, snapshot: null });

describe('periods', () => {
  it.each([
    [local(2026, 3, 31), 1, local(2026, 2, 28)],
    [local(2024, 3, 31), 1, local(2024, 2, 29)], // a leap year
    [local(2026, 1, 15), 1, local(2025, 12, 15)],
    [local(2026, 5, 31), 3, local(2026, 2, 28)],
    [local(2024, 2, 29), 12, local(2023, 2, 28)],
    [local(2026, 10, 5), 36, local(2023, 10, 5)],
  ])('goes back from %s %i months to %s', (from, months, want) => {
    expect(monthsBefore(from, months)).toEqual(want);
  });

  it('covers each preset until now, from local midnight', () => {
    const now = local(2026, 10, 5, 15, 30);
    expect(periodOf('1M', now)).toEqual({ from: local(2026, 9, 5), to: now, untilNow: true });
    expect(periodOf('3M', now).from).toEqual(local(2026, 7, 5));
    expect(periodOf('6M', now).from).toEqual(local(2026, 4, 5));
    expect(periodOf('YTD', now).from).toEqual(local(2026, 1, 1));
    expect(periodOf('1Y', now).from).toEqual(local(2025, 10, 5));
    expect(periodOf('3Y', now).from).toEqual(local(2023, 10, 5));
    expect(periodOf('ALL', now)).toEqual({ from: null, to: now, untilNow: true });
  });

  it('takes a custom period between two dates, whole days', () => {
    const now = local(2026, 10, 5, 15, 30);
    expect(periodOf('CUSTOM', now, { from: '2026-01-10', to: '2026-03-20' })).toEqual({
      from: local(2026, 1, 10), to: new Date(2026, 2, 20, 23, 59, 59, 999), untilNow: false,
    });
    const untilToday = periodOf('CUSTOM', now, { from: '2026-01-10', to: '2026-10-05' });
    expect(untilToday).toEqual({ from: local(2026, 1, 10), to: now, untilNow: true });
    // Dates that don't make one: all time.
    expect(periodOf('CUSTOM', now, { from: '2026-03-01', to: '2026-01-01' }).from).toBeNull();

    expect(customProblem('', '2026-01-01', now)).toBe('Pick both dates');
    expect(customProblem('2026-02-30', '2026-03-01', now)).toBe('Pick both dates');
    expect(customProblem('2026-03-01', '2026-01-01', now)).toBe("The end can't be before the start");
    expect(customProblem('2026-01-01', '2026-10-06', now)).toBe("The end can't be in the future");
    expect(customProblem('2026-10-05', '2026-10-05', now)).toBeUndefined();
    expect(localDay('2026-13-01')).toBeNull();
  });

  const SNAPSHOTS = [
    snap('a', local(2025, 9, 1, 12), 100),
    snap('b', local(2025, 11, 1, 12), 120),
    snap('c', local(2026, 1, 1, 12), 90), // a drop of 30 from the high
    snap('d', local(2026, 4, 1, 12), 150),
    snap('e', local(2026, 7, 1, 12), 140),
  ];

  it("measures from the checkpoint at or before the period's start, to its last point", () => {
    const now = local(2026, 10, 5, 15);
    const period = periodOf('1Y', now); // from Oct 5, 2025
    const points = pointsIn(SNAPSHOTS, period, today(now, 160));
    expect(points.map((p) => p.value)).toEqual([120, 90, 150, 140, 160]);
    const { start, end } = periodEnds(SNAPSHOTS, period, points);
    expect(start!.value).toBe(100); // September's, before the period
    expect(end!.snapshot).toBeNull(); // today

    const stats = periodStats(start, points, end)!;
    expect(stats.change.usd).toBe(60);
    expect(stats.change.pct).toBe(60);
    expect(Math.round(stats.days)).toBe(399);
    expect(stats.annualizedPct).toBeCloseTo((1.6 ** (365.25 / stats.days) - 1) * 100, 6);
    expect(stats.high.value).toBe(160);
    expect(stats.low.value).toBe(90);
    expect(stats.drawdown).toMatchObject({ usd: -30, from: { value: 120 }, to: { value: 90 } });
    expect(stats.drawdown!.pct).toBe(-25);
    expect(stats.best).toMatchObject({ usd: 60, from: { value: 90 }, to: { value: 150 } });
    expect(stats.worst).toMatchObject({ usd: -30 });

    // Without today's value, the last checkpoint ends it.
    const noToday = pointsIn(SNAPSHOTS, period, null);
    expect(periodEnds(SNAPSHOTS, period, noToday).end!.value).toBe(140);
  });

  it('starts with its first point when nothing is from before; a checkpoint on its first instant counts once', () => {
    const now = local(2026, 10, 5, 15);
    const all = periodOf('ALL', now);
    const points = pointsIn(SNAPSHOTS, all, null);
    const { start, end } = periodEnds(SNAPSHOTS, all, points);
    expect(start!.value).toBe(100);
    expect(periodStats(start, points, end)!.best!.usd).toBe(60);

    const exact = { from: local(2025, 11, 1, 12), to: now, untilNow: true };
    const fromB = pointsIn(SNAPSHOTS, exact, null);
    const ends = periodEnds(SNAPSHOTS, exact, fromB);
    expect(ends.start!.snapshot!.id).toBe('b');
    const stats = periodStats(ends.start, fromB, ends.end)!;
    expect(stats.worst!.usd).toBe(-30);
    expect(stats.best!.usd).toBe(60);
  });

  it('says less when it has less to say', () => {
    const now = local(2026, 10, 5, 15);
    // A month without checkpoints, nor today's value: nothing to measure.
    const empty = periodOf('CUSTOM', now, { from: '2026-08-01', to: '2026-08-31' });
    const none = pointsIn(SNAPSHOTS, empty, today(now, 1));
    expect(none).toEqual([]);
    expect(periodEnds(SNAPSHOTS, empty, none)).toEqual({ start: null, end: null });
    expect(periodStats(null, [], null)).toBeNull();

    // A short period: no annualized change; nothing fell, nothing to say about drops.
    const month = periodOf('1M', now);
    const points = pointsIn([snap('x', local(2026, 9, 20), 100)], month, today(now, 110));
    const ends = periodEnds([snap('x', local(2026, 9, 20), 100)], month, points);
    const stats = periodStats(ends.start, points, ends.end)!;
    expect(stats.annualizedPct).toBeNull();
    expect(stats.drawdown).toBeNull();
    expect(stats.worst).toBeNull();
    expect(stats.change).toMatchObject({ usd: 10, pct: 10 });

    // From zero or below: no %.
    const owing = [snap('n', local(2025, 1, 1), -50)];
    const fromDebt = pointsIn(owing, periodOf('ALL', now), today(now, 25));
    const debtEnds = periodEnds(owing, periodOf('ALL', now), fromDebt);
    const debtStats = periodStats(debtEnds.start, fromDebt, debtEnds.end)!;
    expect(debtStats.change).toMatchObject({ usd: 75, pct: null });
    expect(debtStats.annualizedPct).toBeNull();
  });

  it('labels a time axis by how long it is', () => {
    const short = timeTicks(local(2026, 9, 5), local(2026, 10, 5));
    expect(short).toHaveLength(4);
    expect(short[0].label).toBe('Sep 5');
    expect(short[3].label).toBe('Oct 5');
    expect(timeTicks(local(2025, 10, 5), local(2026, 10, 5))[0].label).toBe('Oct 2025');
    expect(timeTicks(local(2020, 1, 1), local(2026, 10, 5))[0].label).toBe('2020');
    expect(timeTicks(local(2026, 1, 1), local(2026, 1, 1))).toHaveLength(1);
  });

  it('suggests a snapshot after 30 days without one, or before the first', () => {
    const now = local(2026, 10, 5, 9);
    expect(snapshotReminder([], 0, now)).toBeUndefined();
    expect(snapshotReminder([], 3, now)).toEqual({ days: null });
    expect(snapshotReminder([snap('a', local(2026, 9, 5, 23), 1)], 3, now)).toBeUndefined(); // 30 days
    expect(snapshotReminder([snap('a', local(2026, 9, 4, 23), 1)], 3, now)).toEqual({ days: 31 });
  });

  it('reads a checkpoint as a point', () => {
    const s = snap('a', local(2026, 1, 1), -5);
    expect(pointOf(s)).toEqual({ at: new Date(s.capturedAt), value: -5, assets: 0, debts: 5, snapshot: s });
  });
});
