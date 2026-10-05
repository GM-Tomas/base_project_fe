'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HoldingFormDialog } from './HoldingFormDialog';
import type { Holding } from '@/types/wealth';

/** What a holding's row offers wherever it's listed (Assets, a platform's holdings). */
export function useHoldingActions() {
  const { deleteHolding } = useWealth();
  const { openDialog, toast } = useUi();

  return {
    add: (platform?: string) => openDialog((close) => <HoldingFormDialog platform={platform} onClose={close} />),
    edit: (h: Holding) => openDialog((close) => <HoldingFormDialog holding={h} onClose={close} />),
    remove: (h: Holding) =>
      openDialog((close) => (
        <ConfirmDialog
          title="Remove asset?"
          message={`${h.name} on ${h.platform} (${formatCurrency(h.valueUsd)}) will stop counting toward your net worth.`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          failureMessage="Could not remove this asset. Please try again."
          onClose={close}
          onConfirm={async () => {
            await deleteHolding(h.id);
            toast.success('Asset removed');
          }}
        />
      )),
  };
}
