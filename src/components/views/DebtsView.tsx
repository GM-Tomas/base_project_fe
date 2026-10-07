'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency } from '@/lib/calculations';
import { averageRate, debtFreeOutlook, debtFreeSummary, debtKindLabel, dueText, formatRate, payoffText } from '@/lib/debts';
import { useT } from '@/lib/i18n';
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
  const tAll = useT();
  const t = tAll.debts;

  if (debts.length === 0) {
    return (
      <div className="card elev-sm">
        <EmptyState
          title={t.emptyTitle}
          action={
            <button className="btn btn-primary" onClick={() => actions.add()}>
              {t.emptyButton}
            </button>
          }
        >
          {t.emptyText}
        </EmptyState>
      </div>
    );
  }

  const withPayment = debts.filter((d) => d.monthlyPaymentUsd).length;
  const rate = averageRate(debts);
  const debtFree = debtFreeSummary(debtFreeOutlook(debts));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <section className="card elev-sm figures debt-overview" aria-label={t.overview}>
        <div className="figure">
          <div className="card-kicker">{t.youOwe}</div>
          <div className="metric-value">{formatCurrency(debtsUSD)}</div>
          <div className="card-body">{tAll.common.debts(debts.length)}</div>
        </div>
        <div className="figure">
          <div className="card-kicker">{t.monthlyPayments}</div>
          <div className="metric-value">{formatCurrency(monthlyDebtPaymentsUSD)}</div>
          <div className="card-body">
            {withPayment === 0
              ? t.noneSet
              : withPayment < debts.length
                ? t.forSome(withPayment, debts.length)
                : ([t.forOne, t.forBoth][debts.length - 1] ?? t.forAll(debts.length))}
          </div>
        </div>
        <div className="figure">
          <div className="card-kicker">{t.averageRate}</div>
          <div className="metric-value">{rate === null ? '—' : formatRate(Math.round(rate * 10) / 10)}</div>
          <div className="card-body">{rate === null ? t.addRates : t.weighted}</div>
        </div>
        <div className="figure">
          <div className="card-kicker">{debtFree.label}</div>
          <div className="metric-value" style={{ color: TONE_COLOR[debtFree.tone] }}>
            {debtFree.value}
          </div>
          <div className="card-body">{debtFree.detail}</div>
        </div>
      </section>

      <div className="card elev-sm" style={{ padding: '6px 16px 12px', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t.columns.debt}</th>
              <th>{t.columns.leftToPay}</th>
              <th>{t.columns.rate}</th>
              <th>{t.columns.monthly}</th>
              <th>{t.columns.paidOff}</th>
              <th style={{ width: '48px' }}>
                <span className="sr-only">{tAll.common.actions}</span>
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
                    <div className="text-muted debt-sub">{[d.lender, debtKindLabel(d.kind)].filter(Boolean).join(' · ')}</div>
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
                  <td style={{ padding: '6px', textAlign: 'right' }}>
                    <DebtRowActions debt={d} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="table-total">
                {t.total(debts.length, formatCurrency(debtsUSD))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
