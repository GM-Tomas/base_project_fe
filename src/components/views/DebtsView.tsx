'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency } from '@/lib/calculations';
import { averageRate, DEBT_KIND_LABEL, debtFreeOutlook, debtFreeSummary, dueText, formatRate, payoffText } from '@/lib/debts';
import { EmptyState } from '@/components/ui/EmptyState';
import { DebtRowActions, useDebtActions } from '@/components/dialogs/useDebtActions';
import { useOpenDebt, useOpenDebtFromRow } from '@/components/dialogs/DebtDrawer';

const TONE_COLOR = {
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral: 'var(--color-text)',
} as const;

// What's owed: how much, at what cost each month and a year, and when it's all paid off; then each debt,
// largest first, with its terms and its own payoff.
export const DebtsView: React.FC = () => {
  const { debts, debtsUSD, monthlyDebtPaymentsUSD } = useWealth();
  const actions = useDebtActions();
  const openDebt = useOpenDebt();
  const openFromRow = useOpenDebtFromRow();

  if (debts.length === 0) {
    return (
      <div className="card elev-sm">
        <EmptyState
          title="Nothing owed"
          action={
            <button className="btn btn-primary" onClick={() => actions.add()}>
              Add a debt
            </button>
          }
        >
          If you have a card balance, a loan or a mortgage, add it to see your real net worth.
        </EmptyState>
      </div>
    );
  }

  const withPayment = debts.filter((d) => d.monthlyPaymentUsd).length;
  const rate = averageRate(debts);
  const debtFree = debtFreeSummary(debtFreeOutlook(debts));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="debt-overview">
        <div className="card elev-sm">
          <div className="card-kicker">You owe</div>
          <div className="metric-value">{formatCurrency(debtsUSD)}</div>
          <div className="card-body">
            {debts.length} {debts.length === 1 ? 'debt' : 'debts'}
          </div>
        </div>
        <div className="card elev-sm">
          <div className="card-kicker">Monthly payments</div>
          <div className="metric-value">{formatCurrency(monthlyDebtPaymentsUSD)}</div>
          <div className="card-body">
            {withPayment === 0
              ? 'None set yet'
              : withPayment < debts.length
                ? `For ${withPayment} of ${debts.length} debts`
                : (['For your debt', 'For both debts'][debts.length - 1] ?? `For all ${debts.length} debts`)}
          </div>
        </div>
        <div className="card elev-sm">
          <div className="card-kicker">Average rate</div>
          <div className="metric-value">{rate === null ? '—' : formatRate(Math.round(rate * 10) / 10)}</div>
          <div className="card-body">{rate === null ? 'Add the rates to see it' : 'A year, weighted by balance'}</div>
        </div>
        <div className="card elev-sm">
          <div className="card-kicker">{debtFree.label}</div>
          <div className="metric-value" style={{ color: TONE_COLOR[debtFree.tone] }}>
            {debtFree.value}
          </div>
          <div className="card-body">{debtFree.detail}</div>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: '6px 16px 12px', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Debt</th>
              <th>Left to pay</th>
              <th>Rate</th>
              <th>Monthly</th>
              <th>Paid off</th>
              <th style={{ width: '104px' }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {debts.map((d) => {
              const payoff = payoffText(d.payoff);
              const due = dueText(d.dueDay);
              return (
                <tr key={d.id} className="row-clickable" onClick={(e) => openFromRow(e, d)}>
                  <td style={{ padding: '12px 10px' }}>
                    <button type="button" className="link-btn" data-debt-name style={{ fontWeight: 500 }} onClick={() => openDebt(d)}>
                      {d.name}
                    </button>
                    <div className="text-muted debt-sub">{[d.lender, DEBT_KIND_LABEL[d.kind]].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }} className="text-nowrap">
                    {formatCurrency(d.balanceUsd)}
                  </td>
                  <td style={{ padding: '12px 10px' }} className="text-nowrap">
                    {d.interestRatePct !== null ? formatRate(d.interestRatePct) : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ padding: '12px 10px' }} className="text-nowrap">
                    {d.monthlyPaymentUsd !== null ? formatCurrency(d.monthlyPaymentUsd) : <span className="text-muted">—</span>}
                    {due && <div className="text-muted debt-sub">{due}</div>}
                  </td>
                  <td style={{ padding: '12px 10px', color: payoff.tone === 'neutral' ? undefined : TONE_COLOR[payoff.tone] }} className="debt-payoff">
                    {payoff.text}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <DebtRowActions debt={d} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="table-total">
                {debts.length} {debts.length === 1 ? 'debt' : 'debts'} · {formatCurrency(debtsUSD)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
