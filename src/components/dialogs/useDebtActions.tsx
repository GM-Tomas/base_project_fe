'use client';

import React from 'react';
import { HandCoins, Pencil, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import type { DebtMovementKind } from '@/lib/movements';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import type { Debt } from '@/types/wealth';
import { DebtFormDialog } from './DebtFormDialog';
import { DebtPaymentDialog } from './DebtPaymentDialog';

/** What a debt offers wherever it's shown (Debts, its own panel). */
export function useDebtActions() {
  const { deleteDebt } = useWealth();
  const { openDialog, toast } = useUi();

  return {
    add: () => openDialog((close) => <DebtFormDialog onClose={close} />),
    edit: (d: Debt) => openDialog((close) => <DebtFormDialog debt={d} onClose={close} />),
    /** A payment, a new charge or interest. */
    record: (d: Debt, kind?: DebtMovementKind) =>
      openDialog((close) => <DebtPaymentDialog debt={d} kind={kind} onClose={close} />),
    remove: (d: Debt) =>
      openDialog((close) => (
        <ConfirmDialog
          title={`Remove ${d.name}?`}
          message={`Its balance (${formatCurrency(d.balanceUsd)}) will stop counting against your net worth. What was recorded on it stays in your activity.`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          failureMessage="Could not remove this debt. Please try again."
          onClose={close}
          onConfirm={async () => {
            await deleteDebt(d.id);
            toast.success('Debt removed');
          }}
        />
      )),
  };
}

/** A debt row's buttons: pay, edit, remove. */
export function DebtRowActions({ debt: d }: { debt: Debt }) {
  const actions = useDebtActions();
  return (
    <div className="row-actions">
      <IconButton label={`Pay ${d.name}`} onClick={() => actions.record(d)}>
        <HandCoins size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Edit ${d.name}`} onClick={() => actions.edit(d)}>
        <Pencil size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${d.name}`} tone="danger" onClick={() => actions.remove(d)}>
        <Trash2 size={15} aria-hidden />
      </IconButton>
    </div>
  );
}
