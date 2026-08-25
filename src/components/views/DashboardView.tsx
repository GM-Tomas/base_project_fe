'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';

export const DashboardView: React.FC = () => {
  const {
    netWorthFormatted,
    ytdGrowthFormatted,
    ytdLabel,
    platforms,
    holdings,
    liquidityPct,
    illiquidPct,
    classDistribution,
    platformDistribution,
  } = useWealth();

  // Generate gradient parts for donut chart
  let accumulatedPct = 0;
  const gradientParts = classDistribution.map((item) => {
    const start = accumulatedPct;
    accumulatedPct += item.pct;
    return `${item.color} ${start.toFixed(2)}% ${accumulatedPct.toFixed(2)}%`;
  });

  const donutGradient =
    gradientParts.length > 0
      ? `conic-gradient(from -90deg, ${gradientParts.join(', ')})`
      : 'var(--color-neutral-800)';

  // Sort platforms by balance descending for the exposure bars
  const sortedPlatforms = [...platformDistribution].sort((a, b) => b.balanceUSD - a.balanceUSD);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Grid: Hero Net Worth + 4 Quick Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.3fr) 1fr',
          gap: '18px',
        }}
      >
        {/* Hero Card */}
        <div
          style={{
            position: 'relative',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px 28px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Ambient Glow Background Effect */}
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              left: '-40px',
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
              opacity: 0.32,
              animation: 'baseGlow 5s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          {/* Corner accents */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              width: '14px',
              height: '14px',
              borderTop: '1.5px solid var(--color-accent)',
              borderLeft: '1.5px solid var(--color-accent)',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '14px',
              width: '14px',
              height: '14px',
              borderBottom: '1.5px solid var(--color-accent)',
              borderRight: '1.5px solid var(--color-accent)',
              opacity: 0.6,
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--color-positive)',
                animation: 'basePulse 2.2s ease-in-out infinite',
              }}
            />
            <div className="card-kicker" style={{ margin: 0 }}>
              Everything you own, right now
            </div>
          </div>

          <div
            style={{
              fontWeight: 600,
              fontSize: '50px',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              margin: '8px 0 4px',
              position: 'relative',
              color: 'var(--color-text)',
            }}
          >
            {netWorthFormatted}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-positive)', fontWeight: 500 }}>
              {ytdLabel === 'no history yet' ? 'No history yet' : `${ytdGrowthFormatted} ${ytdLabel}`}
            </div>
            <div style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>
              Across {platforms.length} accounts
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="card elev-sm">
            <div className="card-kicker">Ready to spend</div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>
              {liquidityPct}%
            </div>
            <div className="card-body">Cash, funds & crypto you can move quickly</div>
          </div>

          <div className="card elev-sm">
            <div className="card-kicker">Locked in</div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-neutral-300)' }}>
              {illiquidPct}%
            </div>
            <div className="card-body">Term deposits & fixed income</div>
          </div>

          <div className="card elev-sm">
            <div className="card-kicker">Accounts</div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>
              {platforms.length}
            </div>
            <div className="card-body">Banks, brokers & exchanges</div>
          </div>

          <div className="card elev-sm">
            <div className="card-kicker">Holdings</div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>
              {holdings.length}
            </div>
            <div className="card-body">Things you own, tracked one by one</div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Donut Chart + Exposure Bars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: '18px',
        }}
      >
        {/* What you're holding (Asset Class Donut) */}
        <div className="card elev-sm">
          <div className="card-kicker">What you&apos;re holding</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px', marginTop: '6px' }}>
            {/* Donut graphic */}
            <div
              style={{
                width: '128px',
                height: '128px',
                borderRadius: '50%',
                flex: 'none',
                background: donutGradient,
                boxShadow: 'inset 0 0 0 32px var(--color-surface)',
                transition: 'background 0.3s ease',
              }}
            />

            {/* Legend list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', flex: 1, minWidth: 0 }}>
              {classDistribution.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <div
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '3px',
                      background: item.color,
                      flex: 'none',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      color: 'color-mix(in srgb, var(--color-text) 85%, transparent)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
                      fontSize: '12px',
                    }}
                  >
                    {item.pctLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Where it lives (Platform exposure) */}
        <div className="card elev-sm">
          <div className="card-kicker">Where it lives</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            {sortedPlatforms.map((p) => (
              <div key={p.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{p.name}</span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
                    }}
                  >
                    {p.balanceFormatted} · {p.pctLabel}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '4px',
                    background: 'var(--color-neutral-900)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${p.pctOfTotal.toFixed(1)}%`,
                      borderRadius: '4px',
                      background: p.color,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
