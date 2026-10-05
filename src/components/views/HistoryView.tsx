'use client';

import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { generateLinePath, formatCurrency, formatPercentage } from '@/lib/calculations';
import { errorMessage } from '@/lib/apiError';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ActivityList } from '@/components/activity/ActivityList';
import { KIND_GROUPS } from '@/lib/movements';
import type { Snapshot } from '@/types/wealth';

const formatCheckpointLabel = (capturedAt: string) =>
  new Date(capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Everything recorded, newest first: what kind of change, and on which asset or debt.
function ActivitySection() {
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
        empty={
          group || holdingId || debtId
            ? 'Nothing recorded matches this filter'
            : 'Nothing recorded yet: gains, losses, deposits and transfers show up here.'
        }
      />
    </div>
  );
}

export const HistoryView: React.FC = () => {
  const { snapshots, takeSnapshot, deleteSnapshot } = useWealth();
  const { openDialog, toast } = useUi();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState<number | null>(null);

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

  const historyValues = useMemo(() => snapshots.map((s) => s.totalValueUsd), [snapshots]);

  // Generate SVG Path
  const { pathString: historyLinePath, points: histPoints } = useMemo(() => {
    return generateLinePath(historyValues, 680, 220, 24);
  }, [historyValues]);

  const historyAreaPath = useMemo(() => {
    if (histPoints.length < 2) return '';
    const lastPoint = histPoints[histPoints.length - 1];
    const firstPoint = histPoints[0];
    return `${historyLinePath} L ${lastPoint[0].toFixed(1)},200 L ${firstPoint[0].toFixed(1)},200 Z`;
  }, [historyLinePath, histPoints]);

  // Table rows with percentage changes (computed server-side)
  const snapshotRows = useMemo(() => {
    return snapshots.map((s) => {
      const change = s.changePctFromPrevious;
      const isUp = (change ?? 0) > 0;
      const isDown = (change ?? 0) < 0;

      return {
        snapshot: s,
        label: formatCheckpointLabel(s.capturedAt),
        valueFormatted: formatCurrency(s.totalValueUsd),
        changeFormatted: change === null ? '—' : (isUp ? '▲ ' : isDown ? '▼ ' : '– ') + formatPercentage(change),
        changeColor:
          change === null
            ? 'var(--color-neutral-400)'
            : isUp
            ? 'var(--color-positive)'
            : isDown
            ? 'var(--color-negative)'
            : 'var(--color-neutral-400)',
      };
    });
  }, [snapshots]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Historical Chart Card */}
      <div className="card elev-sm" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div className="card-kicker">How you&apos;ve grown</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {error && <span style={{ fontSize: '12.5px', color: 'var(--color-negative)' }}>{error}</span>}
            <button className="btn btn-secondary" onClick={handleTakeSnapshot} disabled={isSaving}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              {isSaving ? 'Saving…' : 'Save a snapshot'}
            </button>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <EmptyState title="No checkpoints yet">
            A checkpoint records your net worth at a moment in time. Save one now, and again every month or so, to
            see how it grows.
          </EmptyState>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '240px', marginTop: '10px' }}>
            <svg viewBox="0 0 680 220" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area Fill */}
              {historyAreaPath && <path d={historyAreaPath} fill="url(#histFill)" opacity="0.6" />}

              {/* Line Path */}
              {historyLinePath && (
                <path
                  d={historyLinePath}
                  fill="none"
                  stroke="var(--color-accent-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Checkpoint dots live outside the stretched SVG (preserveAspectRatio="none" turns circles into ovals) */}
            {snapshots.map((s, idx) => {
              const [x, y] = histPoints[idx];
              const left = (x / 680) * 100;
              const top = (y / 220) * 100;
              const isHovered = hovered === idx;
              return (
                <div
                  key={s.capturedAt + idx}
                  tabIndex={0}
                  aria-label={`${formatCheckpointLabel(s.capturedAt)}: ${formatCurrency(s.totalValueUsd)}`}
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(idx)}
                  onBlur={() => setHovered(null)}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}%`,
                    width: '24px',
                    height: '24px',
                    transform: 'translate(-50%, -50%)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    zIndex: isHovered ? 2 : 1,
                  }}
                >
                  <span
                    style={{
                      width: isHovered ? '12px' : '9px',
                      height: isHovered ? '12px' : '9px',
                      borderRadius: '50%',
                      background: isHovered ? 'var(--color-accent-500)' : 'var(--color-bg)',
                      border: '2px solid var(--color-accent-500)',
                      boxShadow: isHovered ? '0 0 0 4px color-mix(in srgb, var(--color-accent-500) 25%, transparent)' : 'none',
                      transition: 'all 0.12s ease',
                    }}
                  />
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        // keep the tooltip inside the card: flip below for high points, hug the edges at the ends
                        ...(top < 50 ? { top: '30px' } : { bottom: '30px' }),
                        left: left < 15 ? '0' : left > 85 ? 'auto' : '50%',
                        right: left > 85 ? '0' : 'auto',
                        transform: left < 15 || left > 85 ? 'none' : 'translateX(-50%)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)',
                        boxShadow: 'var(--shadow-md)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {formatCurrency(s.totalValueUsd)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
                        {formatCheckpointLabel(s.capturedAt)}
                        {s.debtsUsd > 0 && ` · Assets ${formatCurrency(s.assetsUsd)} · Debts ${formatCurrency(s.debtsUsd)}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Checkpoints Table Card */}
      {snapshotRows.length > 0 && (
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
              {snapshotRows.map((r) => (
                <tr key={r.snapshot.id}>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }}>{r.label}</td>
                  <td style={{ padding: '12px 10px' }} className="text-nowrap">
                    {r.valueFormatted}
                    {r.snapshot.debtsUsd > 0 && (
                      <div className="text-muted debt-sub">
                        Assets {formatCurrency(r.snapshot.assetsUsd)} · Debts {formatCurrency(r.snapshot.debtsUsd)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span
                      style={{
                        color: r.changeColor,
                        fontSize: '13px',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                      }}
                    >
                      {r.changeFormatted}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <IconButton label={`Delete checkpoint of ${r.label}`} tone="danger" onClick={() => confirmDelete(r.snapshot)}>
                      <Trash2 size={15} aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ActivitySection />
    </div>
  );
};
