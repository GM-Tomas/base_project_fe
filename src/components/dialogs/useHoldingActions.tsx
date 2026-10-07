'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import type { RecordableKind } from '@/lib/movements';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HoldingFormDialog } from './HoldingFormDialog';
import { RecordChangeDialog } from './RecordChangeDialog';
import { TransferDialog } from './TransferDialog';
import { ExpectedReturnsDialog } from './ExpectedReturnsDialog';
import type { Holding } from '@/types/wealth';
import { useT } from '@/lib/i18n';

/** What a holding's row offers wherever it's listed (Assets, a platform's holdings, its own panel). */
export function useHoldingActions() {
  const { deleteHolding } = useWealth();
  const { openDialog, toast } = useUi();
  const t = useT();

  return {
    add: (platform?: string) => openDialog((close) => <HoldingFormDialog platform={platform} onClose={close} />),
    /** Every holding's expected return at once. */
    setReturns: () => openDialog((close) => <ExpectedReturnsDialog onClose={close} />),
    edit: (h: Holding) => openDialog((close) => <HoldingFormDialog holding={h} onClose={close} />),
    record: (h: Holding, kind?: RecordableKind) =>
      openDialog((close) => <RecordChangeDialog holding={h} kind={kind} onClose={close} />),
    /** A transfer from this holding, or from one on this platform. */
    transfer: (from: { holding?: Holding; platform?: string } = {}) =>
      openDialog((close) => <TransferDialog from={from.holding} platform={from.platform} onClose={close} />),
    remove: (h: Holding) =>
      openDialog((close) => (
        <ConfirmDialog
          title={t.holding.removeTitle}
          message={t.holding.removeMessage(h.name, h.platform, formatCurrency(h.valueUsd))}
          confirmLabel={t.common.remove}
          busyLabel={t.common.removing}
          failureMessage={t.holding.removeFailed}
          onClose={close}
          onConfirm={async () => {
            await deleteHolding(h.id);
            toast.success(t.holding.removed);
          }}
        />
      )),
  };
}
