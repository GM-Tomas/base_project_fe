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
import { messages, useT } from '@/lib/i18n';

/** "Cash", "Cash and Crypto", "Cash, Equity, Crypto and Gold", "Cash, Equity, Crypto and 2 more". */
export function listNames(names: string[], max = 3): string {
  const t = messages().lists;
  if (names.length <= 1) return names.join('');
  // "and 1 more" says less than the name itself.
  if (names.length <= max + 1) return t.and(names.slice(0, -1), names.at(-1)!);
  return t.andMore(names.slice(0, max), names.length - max);
}

export const DashboardView: React.FC = () => {
  const {
    netWorthUSD,
    netWorthFormatted,
    assetsUSD,
    debtsUSD,
    monthlyDebtPaymentsUSD,
    ytdGrowthFormatted,
    ytdText,
    platforms,
    holdings,
    liquidityPct,
    illiquidPct,
    classDistribution,
    platformDistribution,
    setView,
    openPlatform,
    openSettings,
  } = useWealth();
  const { openDialog } = useUi();
  const t = useT().dashboard;

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

      {/* The net worth, what's behind it, and two figures about it */}
      <div className="dash-top">
        <section className="card elev-sm dash-hero" aria-label={t.netWorth}>
          <div className="card-kicker">{t.netWorth}</div>
          <div className="hero-value" style={{ color: netWorthUSD < 0 ? 'var(--color-negative)' : 'var(--color-text)' }}>
            {netWorthFormatted}
          </div>
          {debtsUSD > 0 && (
            <div className="hero-split">
              {t.assetsAmount(formatCurrency(assetsUSD))} ·{' '}
              <button type="button" className="link-btn" onClick={() => setView('debts')}>
                {t.debtsAmount(formatCurrency(debtsUSD))}
              </button>
              {monthlyDebtPaymentsUSD > 0 && ` · ${messages().common.aMonth(formatCurrency(monthlyDebtPaymentsUSD))}`}
            </div>
          )}
          <div className="hero-meta">
            <span className={ytdGrowthFormatted.startsWith('-') ? 'stat-down' : 'stat-up'}>{ytdText}</span>
            <span>{t.counts(platforms.length, holdings.length)}</span>
          </div>
        </section>

        <div className="dash-metrics">
          <div className="card elev-sm">
            <div className="card-kicker">{t.readyToSpend}</div>
            <div className="metric-value">{liquidityPct}%</div>
            <div className="card-body">
              {liquidNames.length > 0 ? listNames(liquidNames, 2) : t.nothingReady}
              {holdings.length > 0 && ` · ${t.lockedIn(illiquidPct)}`} ·{' '}
              <button type="button" className="link-btn link-accent" onClick={() => openSettings('classes')}>
                {t.change}
              </button>
            </div>
          </div>

          <ExpectedReturnCard />
        </div>
      </div>

      {holdings.length === 0 && (
        <div className="card elev-sm">
          <EmptyState
            title={t.emptyTitle}
            action={
              <button className="btn btn-primary" onClick={() => openDialog((close) => <HoldingFormDialog onClose={close} />)}>
                {t.emptyButton}
              </button>
            }
          >
            {t.emptyText}
          </EmptyState>
        </div>
      )}

      {/* Bottom Grid: Donut Chart + Exposure Bars */}
      {holdings.length > 0 && (
        <div className="dash-bottom">
          {/* What you're holding (Asset Class Donut) */}
          <div className="card elev-sm">
            <div className="card-kicker">{t.holding}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px', marginTop: '6px' }}>
              {/* Donut graphic */}
              <div
                role="img"
                aria-label={t.byClass(classDistribution.map((c) => `${c.label} ${c.pctLabel}`).join(', '))}
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
            <div className="card-kicker">{t.whereItLives}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
              {sortedPlatforms.map((p) => (
                <div key={p.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                    <button
                      type="button"
                      className="link-btn with-avatar"
                      style={{ fontWeight: 500, color: 'var(--color-text)' }}
                      title={messages().common.open(p.name)}
                      onClick={() => openPlatform(p.name)}
                    >
                      <PlatformAvatar text={p.initial} color={p.color} textColor={p.textColor} size={18} />
                      {p.name}
                    </button>
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
  const t = useT().dashboard;
  const { weightedPct, coveragePct, annualUsd } = expectedReturn;
  const setReturns = (
    <button type="button" className="link-btn link-accent" onClick={actions.setReturns}>
      {t.setReturns}
    </button>
  );

  return (
    <div className="card elev-sm">
      <div className="card-kicker">{t.expectedReturn}</div>
      <div className="metric-value">{weightedPct === null ? '—' : t.perYearShort(formatReturn(weightedPct))}</div>
      <div className="card-body">
        {holdings.length === 0 ? (
          t.returnBeforeAssets
        ) : coveragePct === 0 ? (
          <>
            {t.noReturnsYet} {setReturns}
          </>
        ) : (
          <>
            {t.aboutAYear(formatCurrency(annualUsd))}
            {coveragePct < 100 && (
              <>
                {' '}
                · {t.ofPortfolio(formatReturn(coveragePct))} · {setReturns}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
