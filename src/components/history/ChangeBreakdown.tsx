'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { formatSignedCurrency as signed } from '@/lib/calculations';
import { round2 } from '@/lib/returns';
import type { PeriodPoint } from '@/lib/periods';
import type { MovementsSummary } from '@/types/wealth';
import { messages, useT } from '@/lib/i18n';

/** The change split by why, from the movements between the period's start and end; what they don't explain is "Not recorded". */
export function breakdownRows(change: number, summary: MovementsSummary) {
  const e = summary.netWorthEffectUsd;
  const explained = e.investments + e.saving + e.addedRemoved + e.corrections;
  const rows = messages().breakdown.rows;
  return [
    { ...rows.investments, usd: e.investments },
    { ...rows.saving, usd: e.saving },
    { ...rows.addedRemoved, usd: e.addedRemoved },
    { ...rows.corrections, usd: e.corrections },
    { ...rows.notRecorded, usd: round2(change - explained) },
  ];
}

// Why the net worth changed between the period's start and end: each reason's bar, signed (up in green,
// down in red). The movements are added up by the API.
export function ChangeBreakdown({ start, end }: { start: PeriodPoint; end: PeriodPoint }) {
  const { dataVersion } = useWealth();
  const tAll = useT();
  const t = tAll.breakdown;
  const [summary, setSummary] = useState<MovementsSummary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const [from, to] = [start.at.toISOString(), end.at.toISOString()];

  useEffect(() => {
    const current = ++generation.current;
    setError('');
    api
      .getMovementsSummary({ from, to })
      .then((s) => {
        if (current === generation.current) setSummary(s);
      })
      .catch((e) => {
        if (current === generation.current) setError(errorMessage(e, t.failed));
      });
  }, [from, to, dataVersion, attempt]);

  const change = round2(end.value - start.value);
  const rows = summary ? breakdownRows(change, summary) : [];
  const largest = Math.max(...rows.map((r) => Math.abs(r.usd)), 1);

  return (
    <div className="card elev-sm breakdown">
      <div className="breakdown-head">
        <div className="card-kicker" style={{ margin: 0 }}>
          {t.title}
        </div>
        <div className={change > 0 ? 'stat-up' : change < 0 ? 'stat-down' : undefined}>{signed(change)}</div>
      </div>
      {error ? (
        <div className="activity-message" role="alert">
          {error}{' '}
          <button type="button" className="link-btn link-accent" onClick={() => setAttempt((n) => n + 1)}>
            {tAll.common.retry}
          </button>
        </div>
      ) : !summary ? (
        <div className="activity-message">{t.working}</div>
      ) : (
        <>
          <ul className="breakdown-bars" aria-label={t.byReason}>
            {rows.map((r) => (
              <li key={r.label} className="breakdown-row" title={r.hint}>
                <span className="breakdown-label">{r.label}</span>
                <span className="breakdown-track" aria-hidden>
                  <span
                    className={r.usd >= 0 ? 'breakdown-bar breakdown-up' : 'breakdown-bar breakdown-down'}
                    style={{ width: `${(Math.abs(r.usd) / largest) * 100}%` }}
                  />
                </span>
                <span className={r.usd > 0 ? 'breakdown-amount stat-up' : r.usd < 0 ? 'breakdown-amount stat-down' : 'breakdown-amount'}>
                  {signed(r.usd)}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-muted breakdown-note">
            {summary.count === 0 ? t.nothingRecorded : t.fromChanges(summary.count)}
            {summary.transfers > 0 && t.transfers(summary.transfers)}
          </div>
        </>
      )}
    </div>
  );
}
