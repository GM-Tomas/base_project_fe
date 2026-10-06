'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { formatSignedCurrency as signed } from '@/lib/calculations';
import { round2 } from '@/lib/returns';
import type { PeriodPoint } from '@/lib/periods';
import type { MovementsSummary } from '@/types/wealth';

/** The change split by why, from the movements between the period's start and end; what they don't explain is "Not recorded". */
export function breakdownRows(change: number, summary: MovementsSummary) {
  const e = summary.netWorthEffectUsd;
  const explained = e.investments + e.saving + e.addedRemoved + e.corrections;
  return [
    { label: 'Investments', hint: 'What your assets earned: gains − losses, transfer fees and interest on debts', usd: e.investments },
    { label: 'Saving', hint: 'Money in and out: deposits − withdrawals, debts paid or spent with money from outside', usd: e.saving },
    { label: 'Added & removed', hint: 'Assets and debts you started or stopped tracking', usd: e.addedRemoved },
    { label: 'Corrections', hint: 'Values and balances you fixed', usd: e.corrections },
    { label: 'Not recorded', hint: 'What changed without being recorded: values updated without saying why', usd: round2(change - explained) },
  ];
}

// Why the net worth changed between the period's start and end: each reason's bar, signed (up in green,
// down in red). The movements are added up by the API.
export function ChangeBreakdown({ start, end }: { start: PeriodPoint; end: PeriodPoint }) {
  const { dataVersion } = useWealth();
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
        if (current === generation.current) setError(errorMessage(e, "Couldn't work out why it changed. Please try again."));
      });
  }, [from, to, dataVersion, attempt]);

  const change = round2(end.value - start.value);
  const rows = summary ? breakdownRows(change, summary) : [];
  const largest = Math.max(...rows.map((r) => Math.abs(r.usd)), 1);

  return (
    <div className="card elev-sm breakdown">
      <div className="breakdown-head">
        <div className="card-kicker" style={{ margin: 0 }}>
          Why it changed
        </div>
        <div className={change > 0 ? 'stat-up' : change < 0 ? 'stat-down' : undefined}>{signed(change)}</div>
      </div>
      {error ? (
        <div className="activity-message" role="alert">
          {error}{' '}
          <button type="button" className="link-btn link-accent" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : !summary ? (
        <div className="activity-message">Working out why…</div>
      ) : (
        <>
          <ul className="breakdown-bars" aria-label="Why it changed, by reason">
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
            {summary.count === 0
              ? 'Nothing was recorded in this period: all of the change is in "Not recorded".'
              : `From ${summary.count} recorded ${summary.count === 1 ? 'change' : 'changes'}.`}
            {summary.transfers > 0 &&
              ` ${summary.transfers} ${summary.transfers === 1 ? 'transfer' : 'transfers'} moved money between what you own and owe without changing it.`}
          </div>
        </>
      )}
    </div>
  );
}
