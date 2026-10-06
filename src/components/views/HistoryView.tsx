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
import { ActivityList } from '@/components/activity/ActivityList';
import { HistoryChart } from '@/components/history/HistoryChart';
import { PeriodStats } from '@/components/history/PeriodStats';
import { ChangeBreakdown } from '@/components/history/ChangeBreakdown';
import { PastCheckpointDialog } from '@/components/history/PastCheckpointDialog';
import { SnapshotReminder } from '@/components/history/SnapshotReminder';
import { KIND_GROUPS, today } from '@/lib/movements';
import {
  customProblem,
  periodEnds,
  periodOf,
  periodStats,
  PERIOD_PRESETS,
  pointsIn,
  type PeriodPoint,
  type PeriodPreset,
} from '@/lib/periods';
import type { Snapshot } from '@/types/wealth';

const formatCheckpointLabel = (capturedAt: string) =>
  new Date(capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Everything recorded in the period, newest first: what kind of change, and on which asset or debt.
function ActivitySection({ from, to }: { from?: string; to?: string }) {
  const { holdings, debts } = useWealth();
  const [group, setGroup] = useState<string | null>(null);
  // "holding:<id>", "debt:<id>", or empty for everything.
  const [subject, setSubject] = useState('');
  const kinds = KIND_GROUPS.find((g) => g.label === group)?.kinds;
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
    <div className="card elev-sm" style={{ padding: '18px 20px' }}>
      <div className="card-kicker">Activity</div>
      <div className="activity-filters">
        <div className="chips" role="group" aria-label="Kind of change">
          {[null, ...KIND_GROUPS.map((g) => g.label)].map((label) => (
            <button key={label ?? 'all'} type="button" className="chip" aria-pressed={group === label} onClick={() => setGroup(label)}>
              {label ?? 'All'}
            </button>
          ))}
        </div>
        <select
          className="input activity-asset"
          aria-label={debts.length ? 'Filter by asset or debt' : 'Filter by asset'}
          value={holdingId ? `holding:${holdingId}` : debtId ? `debt:${debtId}` : ''}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">{debts.length ? 'All assets and debts' : 'All assets'}</option>
          {debts.length ? (
            <>
              <optgroup label="Assets">{assetOptions}</optgroup>
              <optgroup label="Debts">
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
        empty={
          group || holdingId || debtId
            ? 'Nothing recorded matches this filter'
            : from
              ? 'Nothing recorded in this period'
              : 'Nothing recorded yet: gains, losses, deposits and transfers show up here.'
        }
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
      toast.success('Snapshot saved');
    } catch (e) {
      setError(errorMessage(e, 'Could not save a snapshot right now'));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (s: Snapshot) => {
    const when = formatCheckpointLabel(s.capturedAt);
    openDialog((close) => (
      <ConfirmDialog
        title="Delete checkpoint?"
        message={`The checkpoint of ${when} (${formatCurrency(s.totalValueUsd)}) will be removed from your history.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        failureMessage="Could not delete this checkpoint. Please try again."
        onClose={close}
        onConfirm={async () => {
          await deleteSnapshot(s.id);
          toast.success('Checkpoint deleted');
        }}
      />
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* The card below has the button to save one. */}
      <SnapshotReminder withSave={false} />

      <div className="card elev-sm" style={{ padding: '18px 22px' }}>
        <div className="history-head">
          <SegmentedControl label="Period" options={PERIOD_PRESETS} value={preset} onChange={pick} />
          <div className="history-actions">
            {error && <span className="field-error" style={{ margin: 0 }}>{error}</span>}
            <button className="btn btn-secondary" onClick={() => openDialog((close) => <PastCheckpointDialog onClose={close} />)}>
              <CalendarPlus size={14} aria-hidden />
              Add a past checkpoint
            </button>
            <button className="btn btn-primary" onClick={handleTakeSnapshot} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save a snapshot'}
            </button>
          </div>
        </div>
        {preset === 'CUSTOM' && (
          <div className="history-custom">
            <div className="field">
              <label htmlFor="history-from">From</label>
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
              <label htmlFor="history-to">To</label>
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
            {customError && <div className="field-error">{customError}: showing all time.</div>}
          </div>
        )}
        {period.untilNow && (
          <label className="check">
            <input
              type="checkbox"
              checked={includeToday}
              onChange={(e) => setHistoryPeriod((p) => ({ ...p, includeToday: e.target.checked }))}
            />
            Include today&apos;s value
          </label>
        )}

        {snapshots.length === 0 ? (
          <EmptyState title="No checkpoints yet">
            A checkpoint records your net worth at a moment in time. Save one now, and again every month or so, to
            see how it grows. Had one from before? Add it as a past checkpoint.
          </EmptyState>
        ) : checkpoints.length === 0 ? (
          <EmptyState
            title="No checkpoints in this period"
            action={
              <button className="btn btn-secondary" onClick={() => setHistoryPeriod((p) => ({ ...p, preset: 'ALL' }))}>
                Show all time
              </button>
            }
          >
            {stats ? `It went from ${formatCurrency(stats.start.value)} to ${formatCurrency(stats.end.value)}.` : 'Pick a longer period.'}
          </EmptyState>
        ) : (
          <>
            <HistoryChart points={points} start={start} from={chartFrom} to={chartTo} />
            {start && (
              <div className="chart-legend history-legend">
                <span className="legend-dash" aria-hidden /> Start: {formatCurrency(start.value)}
                {start.snapshot && ` on ${formatCheckpointLabel(start.snapshot.capturedAt)}`}
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

      {checkpoints.length > 0 && (
        <div className="card elev-sm" style={{ padding: '6px 16px 16px', overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Checkpoint</th>
                <th>Net worth</th>
                <th>Change</th>
                <th style={{ width: '48px' }}>
                  <span className="sr-only">Actions</span>
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
                          <span className="manual-mark" title="Added by hand" aria-label="Added by hand" role="img">
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
                          Assets {formatCurrency(s.assetsUsd)} · Debts {formatCurrency(s.debtsUsd)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ color: tone, fontSize: '13px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {change === null ? '—' : (change > 0 ? '▲ ' : change < 0 ? '▼ ' : '– ') + formatPercentage(change)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <IconButton label={`Delete checkpoint of ${label}`} tone="danger" onClick={() => confirmDelete(s)}>
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActivitySection from={period.from?.toISOString()} to={period.untilNow ? undefined : period.to.toISOString()} />
    </div>
  );
};
