'use client';

import React, { useMemo } from 'react';
import { useWealth } from '@/context/WealthContext';
import {
  fvYears,
  monthsToReach,
  dateLabelFromMonths,
  generateLinePath,
  formatCurrency,
} from '@/lib/calculations';

export const EstimateView: React.FC = () => {
  const { netWorthUSD, currency, fxRate, estimateParams, setEstimateParams } = useWealth();
  const { contribution, yieldPct, years } = estimateParams;

  // Calculate annual series
  const estimateSeries = useMemo(() => {
    return Array.from({ length: years + 1 }, (_, y) =>
      fvYears(netWorthUSD, contribution, yieldPct, y)
    );
  }, [netWorthUSD, contribution, yieldPct, years]);

  // Generate SVG Path
  const { pathString: estimatePath, points: estPoints } = useMemo(() => {
    return generateLinePath(estimateSeries, 680, 260, 24);
  }, [estimateSeries]);

  const estimateAreaPath = useMemo(() => {
    if (estPoints.length < 2) return '';
    const lastPoint = estPoints[estPoints.length - 1];
    const firstPoint = estPoints[0];
    return `${estimatePath} L ${lastPoint[0].toFixed(1)},236 L ${firstPoint[0].toFixed(1)},236 Z`;
  }, [estimatePath, estPoints]);

  const chartGridLines = [0, 1, 2, 3, 4].map((i) => ({ y: 24 + i * ((260 - 48) / 4) }));

  // Final value in N years
  const finalValue = estimateSeries[estimateSeries.length - 1] || netWorthUSD;
  const estimateFinalLabel = formatCurrency(finalValue, currency, fxRate);

  // Milestone Calculations
  const maxMonths = years * 12;
  const m150 = monthsToReach(150000, netWorthUSD, contribution, yieldPct, maxMonths);
  const m250 = monthsToReach(250000, netWorthUSD, contribution, yieldPct, maxMonths);

  const milestone150Label =
    netWorthUSD >= 150000
      ? 'already there'
      : m150 === null
      ? `not within ${years}y at this pace`
      : dateLabelFromMonths(m150);

  const milestone250Label =
    netWorthUSD >= 250000
      ? 'already there'
      : m250 === null
      ? `not within ${years}y at this pace`
      : dateLabelFromMonths(m250);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 280px) 1fr',
        gap: '20px',
      }}
    >
      {/* Parameter Controls Sidebar Card */}
      <div className="card elev-sm" style={{ gap: '18px', padding: '22px 20px' }}>
        <div className="card-kicker">If you keep this up</div>

        {/* Monthly Contribution Slider */}
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <label style={{ margin: 0 }}>Saving each month</label>
            <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
              ${contribution.toLocaleString('en-US')}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="4000"
            step="50"
            value={contribution}
            onChange={(e) =>
              setEstimateParams((prev) => ({ ...prev, contribution: Number(e.target.value) }))
            }
          />
        </div>

        {/* Yearly Growth Yield Slider */}
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <label style={{ margin: 0 }}>Yearly growth</label>
            <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
              {yieldPct.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="0.5"
            value={yieldPct}
            onChange={(e) =>
              setEstimateParams((prev) => ({ ...prev, yieldPct: Number(e.target.value) }))
            }
          />
        </div>

        {/* Looking Ahead Horizon Slider */}
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <label style={{ margin: 0 }}>Looking ahead</label>
            <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
              {years} {years === 1 ? 'year' : 'years'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            value={years}
            onChange={(e) =>
              setEstimateParams((prev) => ({ ...prev, years: Number(e.target.value) }))
            }
          />
        </div>

        <div className="hr" style={{ margin: '4px 0' }} />

        <div
          style={{
            fontSize: '12.5px',
            color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
            lineHeight: 1.55,
          }}
        >
          Slide these around — the chart updates as you go, so you can see what a bit more saving or a slower year would actually mean.
        </div>
      </div>

      {/* Forecast Chart & Milestones Card */}
      <div className="card elev-sm" style={{ padding: '22px' }}>
        <div className="card-kicker">
          Where you&apos;re headed, next {years} {years === 1 ? 'year' : 'years'}
        </div>

        <div style={{ position: 'relative', width: '100%', height: '280px', marginTop: '6px' }}>
          <svg viewBox="0 0 680 260" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id="baseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.38" />
                <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {chartGridLines.map((g, idx) => (
              <line
                key={idx}
                x1="24"
                x2="656"
                y1={g.y}
                y2={g.y}
                stroke="var(--color-divider)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area Fill */}
            {estimateAreaPath && <path d={estimateAreaPath} fill="url(#baseFill)" opacity="0.75" />}

            {/* Line Path */}
            {estimatePath && (
              <path
                d={estimatePath}
                fill="none"
                stroke="var(--color-accent-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        <div className="hr" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
          <div>
            <div className="card-kicker">Next milestone</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px', color: 'var(--color-text)' }}>
              $150k
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
                marginTop: '2px',
              }}
            >
              {milestone150Label}
            </div>
          </div>

          <div>
            <div className="card-kicker">Bigger milestone</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px', color: 'var(--color-text)' }}>
              $250k
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
                marginTop: '2px',
              }}
            >
              {milestone250Label}
            </div>
          </div>

          <div>
            <div className="card-kicker">In {years} years</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px', color: 'var(--color-accent)' }}>
              {estimateFinalLabel}
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
                marginTop: '2px',
              }}
            >
              at this pace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
