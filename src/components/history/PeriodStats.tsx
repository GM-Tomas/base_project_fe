'use client';

import React from 'react';
import { formatCurrency, formatSignedCurrency as signed, formatSignedPercentage as percent } from '@/lib/calculations';
import { formatDay } from '@/lib/movements';
import type { PeriodPoint, PeriodStats as Stats, Stretch } from '@/lib/periods';
import { messages, useT } from '@/lib/i18n';

const when = (p: PeriodPoint) => (p.snapshot ? formatDay(p.snapshot.capturedAt) : messages().stats.today);
const pctOf = (s: Stretch) => (s.pct === null ? '' : ` (${percent(s.pct)})`);
const tone = (usd: number) => (usd > 0 ? 'stat-up' : usd < 0 ? 'stat-down' : '');

function Stat({ label, value, sub, className }: { label: string; value: string; sub: string; className?: string }) {
  return (
    <div className="figure">
      <div className="stat-label">{label}</div>
      <div className={className ? `stat-value ${className}` : 'stat-value'}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// What a period's points say: how much it changed (and annualized, with enough time) and the worst drop
// from a high; folded away, its high and low and the best and worst stretch between two checkpoints in a row.
export function PeriodStats({ stats }: { stats: Stats }) {
  const { change, start, end, annualizedPct, high, low, drawdown, best, worst } = stats;
  const t = useT().stats;
  return (
    <section className="period-figures" aria-label={t.group} role="group">
      <div className="card elev-sm figures figures-3">
        <Stat
          label={t.change}
          value={`${signed(change.usd)}${pctOf(change)}`}
          sub={t.changeSub(formatCurrency(start.value), when(start), formatCurrency(end.value), end.snapshot ? when(end) : null)}
          className={tone(change.usd)}
        />
        <Stat
          label={t.annualized}
          value={annualizedPct === null ? '—' : t.aYear(percent(annualizedPct))}
          sub={annualizedPct === null ? t.needs90 : t.includesSaved}
          className={annualizedPct === null ? undefined : tone(annualizedPct)}
        />
        <Stat
          label={t.biggestDrop}
          value={drawdown ? `${signed(drawdown.usd)}${pctOf(drawdown)}` : t.none}
          sub={drawdown ? t.fromHigh(when(drawdown.from), when(drawdown.to)) : t.neverFell}
          className={drawdown ? 'stat-down' : undefined}
        />
      </div>
      <details className="more">
        <summary>{t.more}</summary>
        <div className="card elev-sm figures">
          <Stat label={t.high} value={formatCurrency(high.value)} sub={when(high)} />
          <Stat label={t.low} value={formatCurrency(low.value)} sub={when(low)} />
          <Stat
            label={t.best}
            value={best ? `${signed(best.usd)}${pctOf(best)}` : '—'}
            sub={best ? `${when(best.from)} → ${when(best.to)}` : t.noRise}
            className={best ? 'stat-up' : undefined}
          />
          <Stat
            label={t.worst}
            value={worst ? `${signed(worst.usd)}${pctOf(worst)}` : '—'}
            sub={worst ? `${when(worst.from)} → ${when(worst.to)}` : t.noFall}
            className={worst ? 'stat-down' : undefined}
          />
        </div>
      </details>
    </section>
  );
}
