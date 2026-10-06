'use client';

import React, { useMemo, useState } from 'react';
import { generateLinePath, formatCurrency } from '@/lib/calculations';
import { compactUsd, niceTicks, yearTicks } from '@/lib/chartScale';
import type { ProjectionPoint } from '@/types/wealth';

// The SVG is stretched to its box (preserveAspectRatio="none"), so lines are drawn in its coordinates and
// everything with text or round shapes (axis labels, the year's dots and its tooltip) is laid over it in %.
const W = 680;
const H = 260;
const PAD = 24;

export interface ProjectionChartProps {
  series: ProjectionPoint[];
  /** Draws the net worth (the portfolio less what's still owed) too. */
  showNetWorth: boolean;
  /** In today's dollars instead of each year's. */
  real: boolean;
  /** The calendar year of year 0. */
  startYear: number;
}

/**
 * Where the portfolio (and the net worth, with debts) is headed, year by year, with labeled axes. Hovering, or
 * the arrow keys once it has the focus, show a year's figures.
 */
export function ProjectionChart({ series, showNetWorth, real, startYear }: ProjectionChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const portfolio = useMemo(() => series.map((p) => (real ? p.realFutureValueUsd : p.futureValueUsd)), [series, real]);
  const netWorth = useMemo(
    () => (showNetWorth ? series.map((p) => (real ? p.realNetWorthUsd : p.netWorthUsd)) : []),
    [series, real, showNetWorth],
  );
  const ticks = useMemo(() => {
    const all = [0, ...portfolio, ...netWorth];
    return niceTicks(Math.min(...all), Math.max(...all));
  }, [portfolio, netWorth]);
  const scale = { min: ticks[0], max: ticks[ticks.length - 1] };
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - scale.min) / (scale.max - scale.min));
  const x = (i: number) => (series.length > 1 ? PAD + (i * (W - 2 * PAD)) / (series.length - 1) : W / 2);

  const line = generateLinePath(portfolio, W, H, PAD, scale);
  const netLine = generateLinePath(netWorth, W, H, PAD, scale);
  const baseline = y(Math.max(scale.min, 0)).toFixed(1);
  const area =
    line.points.length > 1
      ? `${line.pathString} L ${line.points[line.points.length - 1][0].toFixed(1)},${baseline} L ${line.points[0][0].toFixed(1)},${baseline} Z`
      : '';
  const years = series.length - 1;

  const pick = (clientX: number, box: DOMRect) => {
    const svgX = ((clientX - box.left) / box.width) * W;
    setActive(Math.min(years, Math.max(0, Math.round(((svgX - PAD) / (W - 2 * PAD)) * years))));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => Math.min(years, i + 1),
      ArrowLeft: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: () => years,
    };
    const move = keys[e.key];
    if (!move) return;
    e.preventDefault();
    setActive((i) => move(i ?? 0));
  };

  // What it shows, in a sentence: its name for screen readers.
  const drawn = showNetWorth ? netWorth : portfolio;
  const label = `${showNetWorth ? 'Net worth' : 'Portfolio'} from ${formatCurrency(drawn[0])} now to ${formatCurrency(drawn[years])} in ${years} ${
    years === 1 ? 'year' : 'years'
  }${real ? ", in today's dollars" : ''}`;

  const point = active !== null ? series[active] : null;
  const summary = point && describe(point, startYear, showNetWorth, real);

  return (
    <div className="chart">
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
        aria-label={`${label}. Use the arrow keys to read each year.`}
        onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? years)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="baseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line
              key={t}
              x1={PAD}
              x2={W - PAD}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-divider)"
              strokeWidth="1"
              strokeDasharray={t === 0 ? undefined : '4 4'}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {area && <path d={area} fill="url(#baseFill)" opacity="0.75" />}
          {netLine.pathString && (
            <path
              d={netLine.pathString}
              fill="none"
              stroke="var(--color-accent-2)"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {line.pathString && (
            <path
              d={line.pathString}
              fill="none"
              stroke="var(--color-accent-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD} y2={H - PAD} stroke="var(--color-divider)" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {active !== null && (
          <>
            <span className="chart-dot" style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(portfolio[active]) / H) * 100}%` }} />
            {showNetWorth && (
              <span
                className="chart-dot chart-dot-net"
                style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(netWorth[active]) / H) * 100}%` }}
              />
            )}
            <div
              className="chart-tooltip"
              style={
                x(active) / W > 0.6
                  ? { right: `${100 - (x(active) / W) * 100}%`, marginRight: '12px' }
                  : { left: `${(x(active) / W) * 100}%`, marginLeft: '12px' }
              }
            >
              <div className="chart-tooltip-title">{summary!.title}</div>
              {summary!.lines.map(([label, value]) => (
                <div key={label} className="chart-tooltip-line">
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="chart-x" aria-hidden>
        {yearTicks(years).map((year) => (
          <span key={year} style={{ left: `${(x(year) / W) * 100}%` }}>
            {year === 0 ? 'Now' : `${year}y`}
          </span>
        ))}
      </div>
      <div className="sr-only" aria-live="polite">
        {summary && [summary.title, ...summary.lines.map(([label, value]) => `${label} ${value}`)].join('. ')}
      </div>
    </div>
  );
}

// A year's figures, as the tooltip lists them.
function describe(p: ProjectionPoint, startYear: number, showNetWorth: boolean, real: boolean) {
  const title = p.year === 0 ? `Now · ${startYear}` : `In ${p.year} ${p.year === 1 ? 'year' : 'years'} · ${startYear + p.year}`;
  const lines: [string, string][] = real
    ? [
        ["Portfolio, in today's dollars", formatCurrency(p.realFutureValueUsd)],
        ...(showNetWorth ? [["Net worth, in today's dollars", formatCurrency(p.realNetWorthUsd)] as [string, string]] : []),
        ["In that year's dollars", formatCurrency(p.futureValueUsd)],
      ]
    : [
        ['Portfolio', formatCurrency(p.futureValueUsd)],
        ['Put in', formatCurrency(p.totalContributedUsd)],
        [p.interestEarnedUsd < 0 ? 'Lost' : 'Growth', formatCurrency(Math.abs(p.interestEarnedUsd))],
        ...(showNetWorth ? [['Net worth, after debts', formatCurrency(p.netWorthUsd)] as [string, string]] : []),
      ];
  return { title, lines };
}
