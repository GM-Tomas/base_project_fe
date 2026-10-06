'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { HoldingFormDialog } from '@/components/dialogs/HoldingFormDialog';
import { formatCurrency } from '@/lib/calculations';
import { formatReturn } from '@/lib/returns';
import { useHoldingActions } from '@/components/dialogs/useHoldingActions';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { SnapshotReminder } from '@/components/history/SnapshotReminder';

/** "Cash", "Cash and Crypto", "Cash, Equity, Crypto and Gold", "Cash, Equity, Crypto and 2 more". */
export function listNames(names: string[], max = 3): string {
  if (names.length <= 1) return names.join('');
  // "and 1 more" says less than the name itself.
  if (names.length <= max + 1) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

export const DashboardView: React.FC = () => {
  const {
    netWorthUSD,
    netWorthFormatted,
    assetsUSD,
    debtsUSD,
    debts,
    monthlyDebtPaymentsUSD,
    ytdGrowthFormatted,
    ytdLabel,
    platforms,
    holdings,
    liquidityPct,
    illiquidPct,
    classDistribution,
    platformDistribution,
    setView,
  } = useWealth();
  const { openDialog } = useUi();

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
  // What counts as ready to spend: the user's liquid classes they hold something in.
  const liquidNames = classDistribution.filter((c) => c.liquid).map((c) => c.label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SnapshotReminder />

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
              Your net worth, right now
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
              color: netWorthUSD < 0 ? 'var(--color-negative)' : 'var(--color-text)',
            }}
          >
            {netWorthFormatted}
          </div>
          {debtsUSD > 0 && (
            <div className="hero-split">
              Assets {formatCurrency(assetsUSD)} · Debts {formatCurrency(debtsUSD)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
            <div
              style={{
                fontSize: '13px',
                color: ytdGrowthFormatted.startsWith('-') ? 'var(--color-negative)' : 'var(--color-positive)',
                fontWeight: 500,
              }}
            >
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
            <div className="card-body">
              {liquidNames.length > 0 ? `${listNames(liquidNames)} you can move quickly` : 'Nothing you hold counts as ready to spend'}
              {holdings.length > 0 && ` · ${illiquidPct}% locked in`} ·{' '}
              <button type="button" className="link-btn link-accent" onClick={() => setView('settings')}>
                Change
              </button>
            </div>
          </div>

          <ExpectedReturnCard />

          <button type="button" className="card elev-sm card-button" onClick={() => setView('debts')}>
            <div className="card-kicker">You owe</div>
            {debts.length === 0 ? (
              <>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>Nothing owed</div>
                <div className="card-body">Cards, loans or a mortgage go in Debts</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(debtsUSD)}</div>
                <div className="card-body">
                  {debts.length} {debts.length === 1 ? 'debt' : 'debts'}
                  {monthlyDebtPaymentsUSD > 0 && ` · ${formatCurrency(monthlyDebtPaymentsUSD)} a month`}
                </div>
              </>
            )}
          </button>

          <div className="card elev-sm">
            <div className="card-kicker">Holdings</div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>
              {holdings.length}
            </div>
            <div className="card-body">Things you own, tracked one by one</div>
          </div>
        </div>
      </div>

      {holdings.length === 0 && (
        <div className="card elev-sm">
          <EmptyState
            title="Start by adding what you own"
            action={
              <button className="btn btn-primary" onClick={() => openDialog((close) => <HoldingFormDialog onClose={close} />)}>
                Add your first asset
              </button>
            }
          >
            Add each account, fund or coin with what it&apos;s worth in dollars: your net worth, where it lives and how
            it&apos;s split show up here.
          </EmptyState>
        </div>
      )}

      {/* Bottom Grid: Donut Chart + Exposure Bars */}
      {holdings.length > 0 && (
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
                  // The hole: an inset shadow paints over the ring instead (a small pie in a blank ring).
                  mask: 'radial-gradient(farthest-side, transparent 60%, #000 calc(60% + 1px))',
                  WebkitMask: 'radial-gradient(farthest-side, transparent 60%, #000 calc(60% + 1px))',
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
                    <span className="with-avatar" style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      <PlatformAvatar text={p.initial} color={p.color} size={18} />
                      {p.name}
                    </span>
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
      )}
    </div>
  );
};

// What the portfolio is expected to earn in a year, and how much of it that's based on: a way to set the
// returns when some are missing.
function ExpectedReturnCard() {
  const { expectedReturn, holdings } = useWealth();
  const actions = useHoldingActions();
  const { weightedPct, coveragePct, annualUsd } = expectedReturn;
  const setReturns = (
    <button type="button" className="link-btn link-accent" onClick={actions.setReturns}>
      Set returns
    </button>
  );

  return (
    <div className="card elev-sm">
      <div className="card-kicker">Expected return</div>
      <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text)' }}>
        {weightedPct === null ? '—' : `${formatReturn(weightedPct)} / yr`}
      </div>
      <div className="card-body">
        {holdings.length === 0 ? (
          'What your assets earn in a year, once you add them'
        ) : coveragePct === 0 ? (
          <>Say roughly what each asset earns to see it. {setReturns}</>
        ) : (
          <>
            ≈ {formatCurrency(annualUsd)} a year
            {coveragePct < 100 && (
              <>
                {' '}
                · Based on {formatReturn(coveragePct)} of your portfolio. {setReturns}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
