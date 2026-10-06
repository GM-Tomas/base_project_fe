'use client';

import React, { useMemo, useState } from 'react';
import { formatCurrency, formatSignedCurrency } from '@/lib/calculations';
import { compactUsd, niceTicks } from '@/lib/chartScale';
import { formatDay } from '@/lib/movements';
import { describeSpan, timeTicks, type PeriodPoint } from '@/lib/periods';

// As the projection's chart: the SVG is stretched to its box, so lines are drawn in its coordinates and the
// round things and text (dots, axis labels, the tooltip) are laid over it in %.
const W = 680;
const H = 260;
const PAD = 16;

export interface HistoryChartProps {
  /** The period's points, in order (today's value last, if it's in). */
  points: PeriodPoint[];
  /** Where the period's change is measured from: a dashed line at its value. */
  start: PeriodPoint | null;
  /** The span of time drawn. */
  from: Date;
  to: Date;
}

/**
 * The net worth over a period, on a time axis: a checkpoint a month ago sits a month from the end, however
 * many there are in between. Hovering, or the arrow keys once it has the focus, read each point.
 */
export function HistoryChart({ points, start, from, to }: HistoryChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = useMemo(() => {
    const values = [...points.map((p) => p.value), ...(start ? [start.value] : [])];
    return niceTicks(Math.min(...values), Math.max(...values));
  }, [points, start]);
  const [min, max] = [ticks[0], ticks[ticks.length - 1]];
  const span = to.getTime() - from.getTime();
  const x = (at: Date) => (span > 0 ? PAD + ((W - 2 * PAD) * (at.getTime() - from.getTime())) / span : W / 2);
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - min) / (max - min));
  const xy = points.map((p) => [x(p.at), y(p.value)] as const);
  const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'} ${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area =
    xy.length > 1 ? `${line} L ${xy[xy.length - 1][0].toFixed(1)},${H - PAD} L ${xy[0][0].toFixed(1)},${H - PAD} Z` : '';
  const last = points.length - 1;

  const pick = (clientX: number, box: DOMRect) => {
    const svgX = ((clientX - box.left) / box.width) * W;
    let nearest = 0;
    xy.forEach(([px], i) => {
      if (Math.abs(px - svgX) < Math.abs(xy[nearest][0] - svgX)) nearest = i;
    });
    setActive(nearest);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => Math.min(last, i + 1),
      ArrowLeft: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: () => last,
    };
    const move = keys[e.key];
    if (!move) return;
    e.preventDefault();
    setActive((i) => move(i ?? last));
  };

  // What it shows, in a sentence: its name for screen readers.
  const [first, end] = [points[0], points[last]];
  const label =
    last > 0
      ? `Net worth from ${formatCurrency(first.value)} to ${formatCurrency(end.value)} over ${describeSpan(first.at, end.at)}`
      : `Net worth: ${formatCurrency(first.value)}`;

  const point = active !== null ? points[active] : null;
  const previous = active ? points[active - 1] : start && point !== start ? start : null;
  const summary = point && describe(point, previous);

  return (
    <div className="chart history-chart">
      <div className="chart-y" aria-hidden>
        {ticks.map((t) => (
          <span key={t} style={{ top: `${(y(t) / H) * 100}%` }}>
            {compactUsd(t)}
          </span>
        ))}
      </div>
      <div
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the arrow keys to read each point.`}
        onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? last)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.36" />
              <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1={PAD} x2={W - PAD} y1={y(t)} y2={y(t)} stroke="var(--color-divider)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {start && (
            <line
              className="history-baseline"
              x1={PAD}
              x2={W - PAD}
              y1={y(start.value)}
              y2={y(start.value)}
              stroke="var(--color-neutral-400)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {area && <path d={area} fill="url(#historyFill)" opacity="0.7" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="var(--color-accent-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {active !== null && (
            <line x1={xy[active][0]} x2={xy[active][0]} y1={PAD} y2={H - PAD} stroke="var(--color-divider)" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {points.map((p, i) => (
          <span
            key={p.snapshot?.id ?? 'today'}
            className={[
              'chart-dot',
              p.snapshot ? '' : 'chart-dot-today',
              p.snapshot?.source === 'MANUAL' ? 'chart-dot-manual' : '',
              i === active ? 'chart-dot-active' : '',
            ].join(' ')}
            style={{ left: `${(xy[i][0] / W) * 100}%`, top: `${(xy[i][1] / H) * 100}%` }}
          />
        ))}
        {point && summary && (
          <div
            className="chart-tooltip"
            style={
              xy[active!][0] / W > 0.6
                ? { right: `${100 - (xy[active!][0] / W) * 100}%`, marginRight: '12px' }
                : { left: `${(xy[active!][0] / W) * 100}%`, marginLeft: '12px' }
            }
          >
            <div className="chart-tooltip-title">{summary.title}</div>
            {summary.lines.map(([label, value]) => (
              <div key={label} className="chart-tooltip-line">
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chart-x" aria-hidden>
        {timeTicks(from, to).map((t) => (
          <span key={t.at.getTime()} style={{ left: `${(x(t.at) / W) * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>
      <div className="sr-only" aria-live="polite">
        {summary && [summary.title, ...summary.lines.map(([label, value]) => `${label} ${value}`)].join('. ')}
      </div>
    </div>
  );
}

// A point's figures, as the tooltip lists them: its value, what it was made of, and its change from the
// point before.
function describe(p: PeriodPoint, previous: PeriodPoint | null) {
  const title = p.snapshot ? `${formatDay(p.snapshot.capturedAt)}${p.snapshot.source === 'MANUAL' ? ' · added by hand' : ''}` : 'Today';
  const lines: [string, string][] = [['Net worth', formatCurrency(p.value)]];
  if (p.debts > 0) lines.push(['Assets', formatCurrency(p.assets)], ['Debts', formatCurrency(p.debts)]);
  if (previous) {
    lines.push([`Since ${previous.snapshot ? formatDay(previous.snapshot.capturedAt) : 'today'}`, formatSignedCurrency(p.value - previous.value)]);
  }
  return { title, lines };
}
