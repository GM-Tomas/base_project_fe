'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, NotebookPen, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency, formatPercentage } from '@/lib/calculations';
import { errorMessage } from '@/lib/apiError';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tabs } from '@/components/ui/Tabs';
import { ActivityList } from '@/components/activity/ActivityList';
import { HistoryChart } from '@/components/history/HistoryChart';
import { PeriodStats } from '@/components/history/PeriodStats';
import { ChangeBreakdown } from '@/components/history/ChangeBreakdown';
import { PastCheckpointDialog } from '@/components/history/PastCheckpointDialog';
import { KIND_GROUPS, today, type KindGroup } from '@/lib/movements';
import { intlLocale, useT } from '@/lib/i18n';
import {
  customProblem,
  periodEnds,
  periodOf,
  periodStats,
  periodPresets,
  pointsIn,
  type PeriodPoint,
  type PeriodPreset,
} from '@/lib/periods';
import type { Snapshot } from '@/types/wealth';

const formatCheckpointLabel = (capturedAt: string) =>
  new Date(capturedAt).toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' });

type HistoryTab = 'overview' | 'checkpoints' | 'activity';
const TABS: HistoryTab[] = ['overview', 'checkpoints', 'activity'];

// Everything recorded in the period, newest first: what kind of change, and on which asset or debt.
function ActivitySection({ from, to }: { from?: string; to?: string }) {
  const { holdings, debts } = useWealth();
  const t = useT().activity;
  const groups = useT().movements.groups;
  const [group, setGroup] = useState<KindGroup | null>(null);
  // "holding:<id>", "debt:<id>", or empty for everything.
  const [subject, setSubject] = useState('');
  const kinds = KIND_GROUPS.find((g) => g.id === group)?.kinds;
  // A filter on an asset or a debt that's gone since shows everything.
  const [type, id] = subject.split(':');
  const holdingId = type === 'holding' && holdings.some((h) => h.id === id) ? id : undefined;
  const debtId = type === 'debt' && debts.some((d) => d.id === id) ? id : undefined;
  const byName = [...holdings].sort((a, b) => a.name.localeCompare(b.name));
  const debtsByName = [...debts].sort((a, b) => a.name.localeCompare(b.name));
  const assetOptions = byName.map((h) => (
    <option key={h.id} value={`holding:${h.id}`}>
      {h.name} · {h.platform}
    </option>
  ));

  return (
    <div className="card elev-sm" style={{ padding: '14px 20px' }}>
      <div className="activity-filters">
        <select
          className="input activity-kind"
          aria-label={t.kindOfChange}
          value={group ?? ''}
          onChange={(e) => setGroup((e.target.value || null) as KindGroup | null)}
        >
          <option value="">{t.allKinds}</option>
          {KIND_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {groups[g.id]}
            </option>
          ))}
        </select>
        <select
          className="input activity-asset"
          aria-label={debts.length ? t.filterByAssetOrDebt : t.filterByAsset}
          value={holdingId ? `holding:${holdingId}` : debtId ? `debt:${debtId}` : ''}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">{debts.length ? t.allAssetsAndDebts : t.allAssets}</option>
          {debts.length ? (
            <>
              <optgroup label={t.assetsGroup}>{assetOptions}</optgroup>
              <optgroup label={t.debtsGroup}>
                {debtsByName.map((d) => (
                  <option key={d.id} value={`debt:${d.id}`}>
                    {d.name}
                    {d.lender ? ` · ${d.lender}` : ''}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            assetOptions
          )}
        </select>
      </div>
      <ActivityList
        kinds={kinds}
        holdingId={holdingId}
        debtId={debtId}
        from={from}
        to={to}
        empty={group || holdingId || debtId ? t.noMatch : from ? t.nothingInPeriod : t.nothingYet}
      />
    </div>
  );
}

// The period's dates, for a custom one: what the preset picked so far covered, to start from.
function customStart(preset: PeriodPreset, now: Date) {
  const period = periodOf(preset, now);
  const day = (d: Date) => today(d);
  return { from: day(period.from ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())), to: day(now) };
}

export const HistoryView: React.FC = () => {
  const { snapshots, takeSnapshot, deleteSnapshot, historyPeriod, setHistoryPeriod, netWorthUSD, assetsUSD, debtsUSD, holdings } =
    useWealth();
  const { openDialog, toast } = useUi();
  const tAll = useT();
  const t = tAll.history;
  const [tab, setTab] = useState<HistoryTab>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const now = useMemo(() => new Date(), [snapshots, historyPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const { preset, from, to, includeToday } = historyPeriod;
  const customError = preset === 'CUSTOM' ? customProblem(from, to, now) : undefined;
  const period = periodOf(preset, now, { from, to });
  const todayPoint: PeriodPoint | null =
    includeToday && holdings.length + snapshots.length > 0
      ? { at: now, value: netWorthUSD, assets: assetsUSD, debts: debtsUSD, snapshot: null }
      : null;
  const points = pointsIn(snapshots, period, todayPoint);
  const { start, end } = periodEnds(snapshots, period, points);
  const stats = periodStats(start, points, end);
  const checkpoints = points.filter((p) => p.snapshot) as (PeriodPoint & { snapshot: Snapshot })[];
  const chartFrom = period.from ?? points[0]?.at ?? now;
  const chartTo = period.untilNow ? now : period.to;

  const pick = (next: PeriodPreset) =>
    setHistoryPeriod((p) => ({ ...p, preset: next, ...(next === 'CUSTOM' && !p.from && customStart(p.preset, new Date())) }));

  const handleTakeSnapshot = async () => {
    setError('');
    setIsSaving(true);
    try {
      await takeSnapshot();
      toast.success(tAll.snapshot.saved);
    } catch (e) {
      setError(errorMessage(e, tAll.snapshot.failed));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (s: Snapshot) => {
    const when = formatCheckpointLabel(s.capturedAt);
    openDialog((close) => (
      <ConfirmDialog
        title={t.deleteTitle}
        message={t.deleteMessage(when, formatCurrency(s.totalValueUsd))}
        confirmLabel={t.delete}
        busyLabel={t.deleting}
        failureMessage={t.deleteFailed}
        onClose={close}
        onConfirm={async () => {
          await deleteSnapshot(s.id);
          toast.success(t.deleted);
        }}
      />
    ));
  };

  const noCheckpoints = (
    <EmptyState title={t.noCheckpoints}>{t.noCheckpointsText}</EmptyState>
  );
  const noneInPeriod = (
    <EmptyState
      title={t.noneInPeriod}
      action={
        <button className="btn btn-secondary" onClick={() => setHistoryPeriod((p) => ({ ...p, preset: 'ALL' }))}>
          {t.showAllTime}
        </button>
      }
    >
      {stats ? t.wentFrom(formatCurrency(stats.start.value), formatCurrency(stats.end.value)) : t.pickLonger}
    </EmptyState>
  );

  return (
    <div className="view-stack">
      <div className="history-controls">
        <div className="history-head">
          <SegmentedControl label={t.period} options={periodPresets()} value={preset} onChange={pick} />
          <div className="history-actions">
            {error && <span className="field-error" style={{ margin: 0 }}>{error}</span>}
            <button className="btn btn-secondary" onClick={() => openDialog((close) => <PastCheckpointDialog onClose={close} />)}>
              <CalendarPlus size={14} aria-hidden />
              {t.addPast}
            </button>
            <button className="btn btn-primary" onClick={handleTakeSnapshot} disabled={isSaving}>
              {isSaving ? tAll.common.saving : tAll.snapshot.save}
            </button>
          </div>
        </div>
        {preset === 'CUSTOM' && (
          <div className="history-custom">
            <div className="field">
              <label htmlFor="history-from">{t.from}</label>
              <input
                id="history-from"
                className="input"
                type="date"
                min="1970-01-01"
                max={today(now)}
                value={from}
                onChange={(e) => setHistoryPeriod((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="history-to">{t.to}</label>
              <input
                id="history-to"
                className="input"
                type="date"
                min={from || '1970-01-01'}
                max={today(now)}
                value={to}
                onChange={(e) => setHistoryPeriod((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
            {customError && <div className="field-error">{t.showingAllTime(customError)}</div>}
          </div>
        )}
        {period.untilNow && (
          <label className="check">
            <input
              type="checkbox"
              checked={includeToday}
              onChange={(e) => setHistoryPeriod((p) => ({ ...p, includeToday: e.target.checked }))}
            />
            {t.includeToday}
          </label>
        )}
      </div>

      <Tabs label={t.tabs.label} tabs={TABS.map((id) => ({ id, label: t.tabs[id] }))} value={tab} onChange={setTab}>
        {tab === 'overview' && (
          <>
            <div className="card elev-sm" style={{ padding: '18px 22px' }}>
              {snapshots.length === 0 ? (
                noCheckpoints
              ) : checkpoints.length === 0 ? (
                noneInPeriod
              ) : (
                <>
                  <HistoryChart points={points} start={start} from={chartFrom} to={chartTo} />
                  {start && (
                    <div className="chart-legend history-legend">
                      <span className="legend-dash" aria-hidden /> {t.start(formatCurrency(start.value))}
                      {start.snapshot && t.onDay(formatCheckpointLabel(start.snapshot.capturedAt))}
                    </div>
                  )}
                </>
              )}
            </div>
            {stats && stats.end !== stats.start && (
              <>
                <PeriodStats stats={stats} />
                <ChangeBreakdown start={stats.start} end={stats.end} />
              </>
            )}
          </>
        )}

        {tab === 'checkpoints' &&
          (checkpoints.length === 0 ? (
            <div className="card elev-sm">{snapshots.length === 0 ? noCheckpoints : noneInPeriod}</div>
          ) : (
            <div className="card elev-sm" style={{ padding: '6px 16px 16px', overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.columns.checkpoint}</th>
                    <th>{t.columns.netWorth}</th>
                    <th>{t.columns.change}</th>
                    <th style={{ width: '48px' }}>
                      <span className="sr-only">{tAll.common.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map(({ snapshot: s }) => {
                    const label = formatCheckpointLabel(s.capturedAt);
                    const change = s.changePctFromPrevious;
                    const tone = change === null || change === 0 ? 'var(--color-neutral-400)' : change > 0 ? 'var(--color-positive)' : 'var(--color-negative)';
                    return (
                      <tr key={s.id}>
                        <td style={{ padding: '12px 10px', fontWeight: 500 }}>
                          <span className="with-avatar">
                            {label}
                            {s.source === 'MANUAL' && (
                              <span className="manual-mark" title={t.addedByHand} aria-label={t.addedByHand} role="img">
                                <NotebookPen size={13} aria-hidden />
                              </span>
                            )}
                          </span>
                          {s.note && <div className="text-muted debt-sub">{s.note}</div>}
                        </td>
                        <td style={{ padding: '12px 10px' }} className="text-nowrap">
                          {formatCurrency(s.totalValueUsd)}
                          {s.debtsUsd > 0 && (
                            <div className="text-muted debt-sub">
                              {t.assetsAndDebts(formatCurrency(s.assetsUsd), formatCurrency(s.debtsUsd))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ color: tone, fontSize: '13px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                            {change === null ? '—' : (change > 0 ? '▲ ' : change < 0 ? '▼ ' : '– ') + formatPercentage(change)}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <IconButton label={t.deleteOf(label)} tone="danger" onClick={() => confirmDelete(s)}>
                            <Trash2 size={15} aria-hidden />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'activity' && (
          <ActivitySection from={period.from?.toISOString()} to={period.untilNow ? undefined : period.to.toISOString()} />
        )}
      </Tabs>
    </div>
  );
};
