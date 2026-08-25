'use client';

import React, { useMemo, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { generateLinePath, formatCurrency, formatPercentage } from '@/lib/calculations';
import { ApiError } from '@/lib/api';

const formatCheckpointLabel = (capturedAt: string) =>
  new Date(capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const HistoryView: React.FC = () => {
  const { snapshots, takeSnapshot } = useWealth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleTakeSnapshot = async () => {
    setError('');
    setIsSaving(true);
    try {
      await takeSnapshot();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save a snapshot right now');
    } finally {
      setIsSaving(false);
    }
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
              />
            )}

            {/* Checkpoint Dot Nodes */}
            {histPoints.map((p, idx) => (
              <circle
                key={idx}
                cx={p[0]}
                cy={p[1]}
                r={3.8}
                fill="var(--color-bg)"
                stroke="var(--color-accent-500)"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Checkpoints Table Card */}
      <div className="card elev-sm" style={{ padding: '6px 16px 16px', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th>Net worth</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {snapshotRows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-neutral-400)' }}>
                  No snapshots yet — save one to start tracking your history.
                </td>
              </tr>
            ) : (
              snapshotRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }}>{r.label}</td>
                  <td style={{ padding: '12px 10px' }} className="text-nowrap">
                    {r.valueFormatted}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
