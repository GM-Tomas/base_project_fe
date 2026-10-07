'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import type { DebtMovementKind } from '@/lib/movements';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import type { Debt } from '@/types/wealth';
import { useT } from '@/lib/i18n';
import { DebtFormDialog } from './DebtFormDialog';
import { DebtPaymentDialog } from './DebtPaymentDialog';

/** What a debt offers wherever it's shown (Debts, its own panel). */
export function useDebtActions() {
  const { deleteDebt } = useWealth();
  const { openDialog, toast } = useUi();
  const t = useT();

  return {
    add: () => openDialog((close) => <DebtFormDialog onClose={close} />),
    edit: (d: Debt) => openDialog((close) => <DebtFormDialog debt={d} onClose={close} />),
    /** A payment, a new charge or interest. */
    record: (d: Debt, kind?: DebtMovementKind) =>
      openDialog((close) => <DebtPaymentDialog debt={d} kind={kind} onClose={close} />),
    remove: (d: Debt) =>
      openDialog((close) => (
        <ConfirmDialog
          title={`${t.common.removeNamed(d.name)}?`}
          message={t.debts.removeMessage(formatCurrency(d.balanceUsd))}
          confirmLabel={t.common.remove}
          busyLabel={t.common.removing}
          failureMessage={t.debts.removeFailed}
          onClose={close}
          onConfirm={async () => {
            await deleteDebt(d.id);
            toast.success(t.debts.removed);
          }}
        />
      )),
  };
}

/** A debt row's ⋯: pay, edit, remove (the row itself opens its panel). */
export function DebtRowActions({ debt: d }: { debt: Debt }) {
  const actions = useDebtActions();
  const t = useT();
  return (
    <Menu
      label={t.common.actionsFor(d.name)}
      iconOnly
      buttonClassName="icon-btn"
      groups={[
        [
          { label: t.debts.pay, run: () => actions.record(d) },
          { label: t.common.edit, run: () => actions.edit(d) },
        ],
        [{ label: t.common.remove, tone: 'danger', run: () => actions.remove(d) }],
      ]}
    >
      <MoreHorizontal size={16} aria-hidden />
    </Menu>
  );
}
