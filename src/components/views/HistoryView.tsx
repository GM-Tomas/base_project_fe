'use client';

import React, { useMemo } from 'react';
import { useWealth } from '@/context/WealthContext';
import { generateLinePath, formatCurrency, formatPercentage } from '@/lib/calculations';

export const HistoryView: React.FC = () => {
  const { history, takeSnapshot } = useWealth();

  const historyValues = useMemo(() => history.map((s) => s.v), [history]);

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

  // Table rows with percentage changes
  const snapshotRows = useMemo(() => {
    return history.map((s, i) => {
      const prev = i > 0 ? history[i - 1].v : s.v;
      const change = i === 0 ? 0 : ((s.v - prev) / prev) * 100;
      const isUp = change > 0;
      const isDown = change < 0;

      return {
        label: s.m,
        valueFormatted: formatCurrency(s.v),
        changeFormatted: i === 0 ? '—' : (isUp ? '▲ ' : isDown ? '▼ ' : '– ') + formatPercentage(change),
        changeColor:
          i === 0
            ? 'var(--color-neutral-400)'
            : isUp
            ? 'var(--color-positive)'
            : isDown
            ? 'var(--color-negative)'
            : 'var(--color-neutral-400)',
      };
    });
  }, [history]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Historical Chart Card */}
      <div className="card elev-sm" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-kicker">How you&apos;ve grown</div>
          <button className="btn btn-secondary" onClick={takeSnapshot}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            Save a snapshot
          </button>
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
            {snapshotRows.map((r, i) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
