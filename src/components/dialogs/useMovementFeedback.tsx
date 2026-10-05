'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { errorMessage } from '@/lib/apiError';
import { formatUsd } from '@/lib/money';
import { formatDay, KIND_LABEL, undoSentence } from '@/lib/movements';
import type { Movement } from '@/types/wealth';

const UNDO_FAILED = "Couldn't undo this change. Please try again.";

// What a movement's title says it was, for its confirmation: "Gain of $50.00 on Bitcoin (Oct 3, 2026)".
function summary(m: Movement) {
  const what = `${KIND_LABEL[m.kind]} of ${formatUsd(m.amountUsd)}`;
  const where = m.kind === 'TRANSFER' ? `from ${m.holding!.name} to ${m.toHolding!.name}` : `on ${m.holding!.name}`;
  return `${what} ${where} (${formatDay(m.occurredAt)}).`;
}

/** Saying a movement was recorded (with Undo), and undoing one from a list (asking first). */
export function useMovementFeedback() {
  const { revertMovement } = useWealth();
  const { openDialog, toast } = useUi();

  const undoNow = async (m: Movement) => {
    try {
      await revertMovement(m.id);
    } catch (e) {
      toast.error(errorMessage(e, UNDO_FAILED));
      return;
    }
    toast.success('Change undone');
  };

  return {
    recorded: (m: Movement) =>
      toast.success(`${KIND_LABEL[m.kind]} recorded`, { action: { label: 'Undo', onClick: () => undoNow(m) } }),
    confirmUndo: (m: Movement) =>
      openDialog((close) => (
        <ConfirmDialog
          title="Undo this change?"
          message={`${summary(m)} ${undoSentence(m)}`}
          confirmLabel="Undo"
          busyLabel="Undoing…"
          tone="primary"
          failureMessage={UNDO_FAILED}
          onClose={close}
          onConfirm={async () => {
            await revertMovement(m.id);
            toast.success('Change undone');
          }}
        />
      )),
  };
}
