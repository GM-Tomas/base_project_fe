'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/calculations';
import { compactUsd } from '@/lib/chartScale';
import { formatMonth } from '@/lib/debts';
import { parseAmount } from '@/lib/money';
import { MAX_ADJUSTMENT_PCT, MAX_CONTRIBUTION_USD, MAX_YEARS } from '@/lib/preferences';
import { formatReturn, parsePercent, returnShares, type ReturnShare } from '@/lib/returns';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { PercentInput } from '@/components/ui/PercentInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectionChart } from '@/components/estimate/ProjectionChart';
import { MilestonesDialog } from '@/components/dialogs/MilestonesDialog';
import { useHoldingActions } from '@/components/dialogs/useHoldingActions';
import type { EstimatePreferences, EstimateQuery, Milestone, Projection, YieldMode } from '@/types/wealth';

const DEBOUNCE_MS = 150;
const CONTRIBUTION_SLIDER_MAX = 10_000;
const YIELD_SLIDER = { min: -10, max: 30 };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// What Estimate asks the API for: without a growth of its own, the portfolio's expected return.
const queryOf = (p: EstimatePreferences): EstimateQuery => ({
  contribution: p.contributionUsd,
  years: p.years,
  ...(p.yieldMode === 'CUSTOM' && { yieldPct: p.customYieldPct }),
  milestones: p.milestonesUsd,
  inflationPct: p.inflationPct,
  contributionGrowthPct: p.contributionGrowthPct,
});

/** "$150k", "$1.5M": a milestone in a few characters ($123,456 when it isn't round). */
export const milestoneAmount = (usd: number) => (usd % 1000 === 0 ? compactUsd(usd) : formatCurrency(usd));

const milestoneWhen = (m: Milestone, years: number) => {
  if (m.status === 'ACHIEVED') return 'already there';
  if (m.status === 'OUT_OF_HORIZON') return `not within ${years}y at this pace`;
  return m.targetMonth ? formatMonth(m.targetMonth) : '';
};

export const EstimateView: React.FC = () => {
  const { estimatePrefs: prefs, setEstimatePrefs, dataVersion, holdings } = useWealth();
  const debouncedQuery = useDebouncedValue(useMemo(() => queryOf(prefs), [prefs]), DEBOUNCE_MS);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState('');
  const [real, setReal] = useState(false);

  // Fetched again when the parameters settle, and when the data does (a new asset changes where it starts).
  useEffect(() => {
    let cancelled = false;
    api
      .getEstimate(debouncedQuery)
      .then((res) => {
        if (!cancelled) {
          setProjection(res);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not calculate the projection');
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, dataVersion]);

  const showReal = real && prefs.inflationPct > 0;
  const hasDebts = (projection?.debtsUsd ?? 0) > 0;
  const last = projection?.series[projection.series.length - 1];
  const finalValue = last && (showReal ? last.realFutureValueUsd : last.futureValueUsd);
  const finalNet = last && (showReal ? last.realNetWorthUsd : last.netWorthUsd);

  return (
    <div className="estimate-grid">
      <EstimateControls prefs={prefs} update={(patch) => setEstimatePrefs((p) => ({ ...p, ...patch }))} real={real} setReal={setReal} />

      <div className="card elev-sm" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div className="card-kicker">
            Where you&apos;re headed, next {prefs.years} {prefs.years === 1 ? 'year' : 'years'}
            {showReal && ", in today's dollars"}
          </div>
          {error && <span style={{ fontSize: '12.5px', color: 'var(--color-negative)' }}>{error}</span>}
        </div>
        {hasDebts && (
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-portfolio" aria-hidden />
              Your portfolio
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-net-worth" aria-hidden />
              Net worth, after debts
            </span>
          </div>
        )}

        {projection ? (
          <ProjectionChart series={projection.series} showNetWorth={hasDebts} real={showReal} startYear={new Date().getFullYear()} />
        ) : (
          <div className="chart-placeholder" />
        )}

        <div className="hr" />

        <div className="milestones-row">
          {(projection?.milestones ?? []).map((m) => (
            <div key={m.amountUsd}>
              <div className="card-kicker">Milestone</div>
              <div className="milestone-amount">{milestoneAmount(m.amountUsd)}</div>
              <div className="milestone-when">{milestoneWhen(m, prefs.years)}</div>
            </div>
          ))}
          <div>
            <div className="card-kicker">
              In {prefs.years} {prefs.years === 1 ? 'year' : 'years'}
            </div>
            <div className="milestone-amount" style={{ color: 'var(--color-accent)' }}>
              {finalValue !== undefined ? formatCurrency(finalValue) : '—'}
            </div>
            <div className="milestone-when">
              {finalNet !== undefined && hasDebts ? `${formatCurrency(finalNet)} net of debts` : 'at this pace'}
            </div>
          </div>
        </div>
      </div>

      {holdings.length > 0 && <ReturnBreakdown />}
    </div>
  );
};

interface ControlsProps {
  prefs: EstimatePreferences;
  update: (patch: Partial<EstimatePreferences>) => void;
  real: boolean;
  setReal: (real: boolean) => void;
}

// The parameters: the growth (the portfolio's expected return, or the user's own), the monthly saving, how
// far ahead, the milestones, and the rest folded away.
function EstimateControls({ prefs, update, real, setReal }: ControlsProps) {
  const { expectedReturn, holdings } = useWealth();
  const { openDialog } = useUi();
  const actions = useHoldingActions();
  const ids = { yield: useId(), contribution: useId(), years: useId(), real: useId() };
  const portfolio = expectedReturn.weightedPct;
  const yieldShown = prefs.yieldMode === 'PORTFOLIO' ? (portfolio ?? 0) : prefs.customYieldPct;

  // The typed amount follows the slider; while typing, a valid amount moves the slider.
  const [contributionText, setContributionText] = useState(String(prefs.contributionUsd));
  useEffect(() => {
    setContributionText((text) => (parseAmount(text).value === prefs.contributionUsd ? text : String(prefs.contributionUsd)));
  }, [prefs.contributionUsd]);
  const typeContribution = (text: string) => {
    setContributionText(text);
    const parsed = parseAmount(text);
    if (parsed.value !== undefined && parsed.value <= MAX_CONTRIBUTION_USD) update({ contributionUsd: parsed.value });
  };
  const contributionProblem =
    parseAmount(contributionText).value !== undefined && parseAmount(contributionText).value! > MAX_CONTRIBUTION_USD
      ? `Up to ${formatCurrency(MAX_CONTRIBUTION_USD)} a month`
      : null;

  const setReturns = (
    <button type="button" className="link-btn link-accent" onClick={actions.setReturns}>
      Set returns
    </button>
  );
  const growthHint =
    prefs.yieldMode === 'CUSTOM' ? (
      <>
        Your own growth.{' '}
        <button type="button" className="link-btn link-accent" onClick={() => update({ yieldMode: 'PORTFOLIO' })}>
          Use my portfolio{portfolio !== null && ` (${formatReturn(portfolio)})`}
        </button>
      </>
    ) : portfolio === null ? (
      'Add assets to grow at what they earn.'
    ) : expectedReturn.coveragePct === 0 ? (
      <>No expected returns set yet, so it grows at 0%. {setReturns}</>
    ) : (
      <>
        Your portfolio: {formatReturn(portfolio)} (weighted by value).
        {expectedReturn.coveragePct < 100 && (
          <>
            {' '}
            Based on {formatReturn(expectedReturn.coveragePct)} of it. {setReturns}
          </>
        )}
      </>
    );

  return (
    <div className="card elev-sm" style={{ gap: '18px', padding: '22px 20px' }}>
      <div className="card-kicker">If you keep this up</div>

      <div className="field">
        <div className="slider-head">
          <label htmlFor={ids.yield}>Yearly growth</label>
          <span className="slider-value">{formatReturn(yieldShown)}</span>
        </div>
        <SegmentedControl<YieldMode>
          label="Grow at"
          options={[
            { value: 'PORTFOLIO', label: 'Your portfolio' },
            { value: 'CUSTOM', label: 'Custom' },
          ]}
          value={prefs.yieldMode}
          onChange={(yieldMode) => update({ yieldMode })}
        />
        <input
          id={ids.yield}
          type="range"
          min={YIELD_SLIDER.min}
          max={YIELD_SLIDER.max}
          step="0.5"
          value={Math.min(YIELD_SLIDER.max, Math.max(YIELD_SLIDER.min, yieldShown))}
          aria-valuetext={`${formatReturn(yieldShown)} a year`}
          onChange={(e) => update({ yieldMode: 'CUSTOM', customYieldPct: Number(e.target.value) })}
        />
        <div className="field-hint" style={{ marginTop: 0 }}>
          {growthHint}
        </div>
      </div>

      <div className="field">
        <div className="slider-head">
          <label htmlFor={ids.contribution}>Saving each month</label>
          <span className="slider-value">{formatCurrency(prefs.contributionUsd)}</span>
        </div>
        <input
          id={ids.contribution}
          type="range"
          min="0"
          max={CONTRIBUTION_SLIDER_MAX}
          step="50"
          value={Math.min(prefs.contributionUsd, CONTRIBUTION_SLIDER_MAX)}
          aria-valuetext={`${formatCurrency(prefs.contributionUsd)} a month`}
          onChange={(e) => typeContribution(e.target.value)}
        />
        <MoneyInput label="Or type the amount" value={contributionText} onChange={typeContribution} />
        {contributionProblem && <div className="field-error">{contributionProblem}</div>}
      </div>

      <div className="field">
        <div className="slider-head">
          <label htmlFor={ids.years}>Looking ahead</label>
          <span className="slider-value">
            {prefs.years} {prefs.years === 1 ? 'year' : 'years'}
          </span>
        </div>
        <input
          id={ids.years}
          type="range"
          min="1"
          max={MAX_YEARS}
          step="1"
          value={prefs.years}
          onChange={(e) => update({ years: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <div className="slider-head">
          <span>Milestones</span>
          <button
            type="button"
            className="link-btn link-accent"
            onClick={() => openDialog((close) => <MilestonesDialog onClose={close} />)}
          >
            <Pencil size={12} aria-hidden /> Edit milestones
          </button>
        </div>
        <div className="chips">
          {prefs.milestonesUsd.length ? (
            prefs.milestonesUsd.map((m) => (
              <span key={m} className="tag tag-neutral">
                {milestoneAmount(m)}
              </span>
            ))
          ) : (
            <span className="text-muted">None</span>
          )}
        </div>
      </div>

      <details className="advanced" open={prefs.inflationPct > 0 || prefs.contributionGrowthPct > 0 || undefined}>
        <summary>More options</summary>
        <AdjustmentInput
          label="Raise contributions each year (%)"
          value={prefs.contributionGrowthPct}
          onChange={(contributionGrowthPct) => update({ contributionGrowthPct })}
          hint="Your monthly saving grows this much every 12 months."
        />
        <AdjustmentInput
          label="Inflation (% a year)"
          value={prefs.inflationPct}
          onChange={(inflationPct) => update({ inflationPct })}
          hint="To see the values in today's dollars."
        />
        <label className="check" htmlFor={ids.real}>
          <input id={ids.real} type="checkbox" checked={real && prefs.inflationPct > 0} disabled={prefs.inflationPct <= 0} onChange={(e) => setReal(e.target.checked)} />
          Show in today&apos;s dollars
        </label>
      </details>

      {holdings.length === 0 && (
        <div className="field-hint" style={{ marginTop: 0 }}>
          With no assets yet, this starts from $0.
        </div>
      )}
    </div>
  );
}

// A percentage between 0 and 50 (an inflation, a raise), typed: empty is 0.
function AdjustmentInput({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <PercentInput
      label={label}
      value={text}
      min={0}
      max={MAX_ADJUSTMENT_PCT}
      placeholder="0"
      hint={hint}
      onChange={(next) => {
        setText(next);
        const parsed = parsePercent(next, { min: 0, max: MAX_ADJUSTMENT_PCT });
        if (parsed.error === undefined) onChange(parsed.value ?? 0);
      }}
    />
  );
}

// What the portfolio's expected return is made of: each class's and each asset's share of it, in points.
function ReturnBreakdown() {
  const { holdings, expectedReturn } = useWealth();
  const actions = useHoldingActions();
  const { byClass, byAsset } = returnShares(holdings);
  const [showAll, setShowAll] = useState(false);
  const assets = showAll ? byAsset : byAsset.slice(0, 6);

  return (
    <div className="card elev-sm return-breakdown">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div className="card-kicker">What your expected return is made of</div>
          <div className="card-body">
            {expectedReturn.weightedPct === null
              ? 'Nothing to weigh yet.'
              : `${formatReturn(expectedReturn.weightedPct)} a year: each asset's return, weighted by what it's worth. Assets without one count as 0%.`}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={actions.setReturns}>
          Set expected returns
        </button>
      </div>
      {expectedReturn.coveragePct === 0 ? (
        <EmptyState title="No expected returns yet">
          Say roughly how much each asset grows in a year (a term deposit 4%, an index fund 8%…) to project with
          what your portfolio really earns.
        </EmptyState>
      ) : (
        <div className="breakdown-columns">
          <ShareList title="By class" shares={byClass} />
          <div>
            <ShareList title="By asset" shares={assets} />
            {byAsset.length > 6 && (
              <button type="button" className="link-btn link-accent" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${byAsset.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShareList({ title, shares }: { title: string; shares: ReturnShare[] }) {
  const largest = Math.max(...shares.map((s) => Math.abs(s.points)), 0.0001);
  return (
    <div>
      <h3 className="section-title">{title}</h3>
      <ul className="share-list">
        {shares.map((s) => (
          <li key={s.name}>
            <div className="share-line">
              <span className="share-name">{s.name}</span>
              <span className="text-muted">{s.returnPct === null ? 'no return set' : `${formatReturn(s.returnPct, 2)} a year`}</span>
              <span className={s.points < 0 ? 'share-points amount-negative' : 'share-points'}>
                {s.points < 0 ? '−' : '+'}
                {Math.abs(s.points).toFixed(2)} pts
              </span>
            </div>
            <div className="share-bar">
              <span
                className={s.points < 0 ? 'share-fill share-fill-negative' : 'share-fill'}
                style={{ width: `${(Math.abs(s.points) / largest) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
