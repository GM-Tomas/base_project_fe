'use client';

import React from 'react';
import { formatCurrency, formatSignedCurrency as signed, formatSignedPercentage as percent } from '@/lib/calculations';
import { formatDay } from '@/lib/movements';
import type { PeriodPoint, PeriodStats as Stats, Stretch } from '@/lib/periods';

const when = (p: PeriodPoint) => (p.snapshot ? formatDay(p.snapshot.capturedAt) : 'today');
const pctOf = (s: Stretch) => (s.pct === null ? '' : ` (${percent(s.pct)})`);
const tone = (usd: number) => (usd > 0 ? 'stat-up' : usd < 0 ? 'stat-down' : '');

function Stat({ label, value, sub, className, wide }: { label: string; value: string; sub: string; className?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'stat stat-wide' : 'stat'}>
      <div className="stat-label">{label}</div>
      <div className={className ? `stat-value ${className}` : 'stat-value'}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// What a period's points say: how much it changed (and annualized, with enough time), its high and low, the
// worst drop from a high, and the best and worst stretch between two checkpoints in a row.
export function PeriodStats({ stats }: { stats: Stats }) {
  const { change, start, end, annualizedPct, high, low, drawdown, best, worst } = stats;
  return (
    <div className="stats-grid" aria-label="This period in figures" role="group">
      <Stat
        label="Change"
        wide
        value={`${signed(change.usd)}${pctOf(change)}`}
        sub={`From ${formatCurrency(start.value)} on ${when(start)} to ${formatCurrency(end.value)}${end.snapshot ? ` on ${when(end)}` : ' today'}`}
        className={tone(change.usd)}
      />
      <Stat
        label="Annualized change"
        value={annualizedPct === null ? '—' : `${percent(annualizedPct)} a year`}
        sub={annualizedPct === null ? 'Needs 90 days or more, from above zero' : 'Includes what you saved, not just returns'}
        className={annualizedPct === null ? undefined : tone(annualizedPct)}
      />
      <Stat label="High" value={formatCurrency(high.value)} sub={when(high)} />
      <Stat label="Low" value={formatCurrency(low.value)} sub={when(low)} />
      <Stat
        label="Biggest drop"
        value={drawdown ? `${signed(drawdown.usd)}${pctOf(drawdown)}` : 'None'}
        sub={drawdown ? `From the high of ${when(drawdown.from)} to ${when(drawdown.to)}` : 'It never fell from a high'}
        className={drawdown ? 'stat-down' : undefined}
      />
      <Stat
        label="Best stretch"
        value={best ? `${signed(best.usd)}${pctOf(best)}` : '—'}
        sub={best ? `${when(best.from)} → ${when(best.to)}` : 'No rise between two checkpoints'}
        className={best ? 'stat-up' : undefined}
      />
      <Stat
        label="Worst stretch"
        value={worst ? `${signed(worst.usd)}${pctOf(worst)}` : '—'}
        sub={worst ? `${when(worst.from)} → ${when(worst.to)}` : 'No fall between two checkpoints'}
        className={worst ? 'stat-down' : undefined}
      />
    </div>
  );
}
