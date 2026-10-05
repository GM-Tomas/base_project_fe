'use client';

import React, { useEffect } from 'react';
import { CreditCard, HandCoins, Pencil, Percent, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { ActivityList } from '@/components/activity/ActivityList';
import { DEBT_KIND_LABEL, formatRate, ordinal, payoffDetail, payoffText } from '@/lib/debts';
import { formatUsd } from '@/lib/money';
import { formatDay } from '@/lib/movements';
import type { Debt } from '@/types/wealth';
import { useDebtActions } from './useDebtActions';

// One debt in a panel along the right edge: what's left to pay and on what terms, when it's paid off, what
// can be done with it, and what happened to it. It follows the debt through refreshes, and closes once it's
// gone.
export function DebtDrawer({ debtId, onClose }: { debtId: string; onClose: () => void }) {
  const { debts } = useWealth();
  const actions = useDebtActions();
  const debt = debts.find((d) => d.id === debtId);

  useEffect(() => {
    if (!debt) onClose();
  }, [debt, onClose]);

  if (!debt) return null;
  const payoff = payoffText(debt.payoff);
  const detail = payoffDetail(debt.payoff);
  const terms = [
    { label: 'Interest', value: debt.interestRatePct !== null ? `${formatRate(debt.interestRatePct)} a year` : 'Not set' },
    { label: 'Monthly payment', value: debt.monthlyPaymentUsd !== null ? formatUsd(debt.monthlyPaymentUsd) : 'Not set' },
    { label: 'Due', value: debt.dueDay ? `On the ${ordinal(debt.dueDay)}` : 'Not set' },
  ];

  return (
    <Modal title={debt.name} onClose={onClose} variant="drawer">
      <div className="drawer-meta">
        {debt.lender && <span>{debt.lender}</span>}
        <span className="tag tag-neutral">{DEBT_KIND_LABEL[debt.kind]}</span>
      </div>
      <div>
        <div className="drawer-value">{formatUsd(debt.balanceUsd)}</div>
        <div className="text-muted drawer-dates">
          Left to pay · Added {formatDay(debt.createdAt)} · Updated {formatDay(debt.updatedAt)}
        </div>
      </div>
      <dl className="debt-terms">
        {terms.map((t) => (
          <div key={t.label}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>
      <div className={payoff.tone === 'negative' ? 'preview preview-error' : 'preview'}>
        <div>{payoff.text}</div>
        {detail && <div className="text-muted">{detail}</div>}
      </div>
      {debt.notes && <p className="debt-notes">{debt.notes}</p>}
      <div className="drawer-actions">
        <button type="button" className="btn btn-primary" onClick={() => actions.record(debt, 'DEBT_PAYMENT')}>
          <HandCoins size={14} aria-hidden />
          Pay
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.record(debt, 'DEBT_CHARGE')}>
          <CreditCard size={14} aria-hidden />
          New charge
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.record(debt, 'DEBT_INTEREST')}>
          <Percent size={14} aria-hidden />
          Interest
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.edit(debt)}>
          <Pencil size={14} aria-hidden />
          Edit
        </button>
        <button type="button" className="btn btn-danger" onClick={() => actions.remove(debt)}>
          <Trash2 size={14} aria-hidden />
          Remove
        </button>
      </div>
      <h3 className="section-title">Activity</h3>
      <ActivityList debtId={debt.id} empty="Nothing recorded for this debt yet" />
    </Modal>
  );
}

/** Opens a debt's panel. */
export function useOpenDebt() {
  const { openDialog } = useUi();
  return (d: Debt) => openDialog((close) => <DebtDrawer debtId={d.id} onClose={close} />);
}

/**
 * A click anywhere on a debt's row opens it (its own buttons aside). Focus goes to the row's name button
 * first, so that's where it comes back when the panel closes.
 */
export function useOpenDebtFromRow() {
  const open = useOpenDebt();
  return (e: React.MouseEvent<HTMLElement>, d: Debt) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    e.currentTarget.querySelector<HTMLElement>('[data-debt-name]')?.focus();
    open(d);
  };
}
