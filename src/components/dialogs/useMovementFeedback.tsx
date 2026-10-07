'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { errorMessage } from '@/lib/apiError';
import { formatUsd } from '@/lib/money';
import { formatDay, kindLabel, undoSentence } from '@/lib/movements';
import { messages, useT } from '@/lib/i18n';
import type { Movement } from '@/types/wealth';

// What a movement's title says it was, for its confirmation: "Gain of $50.00 on Bitcoin (Oct 3, 2026)".
function summary(m: Movement) {
  const t = messages().movements;
  const what = t.what(kindLabel(m.kind), formatUsd(m.amountUsd));
  const where = m.kind === 'TRANSFER' ? t.fromTo(m.holding!.name, m.toHolding!.name) : t.on((m.debt ?? m.holding)!.name);
  return `${what} ${where} (${formatDay(m.occurredAt)}).`;
}

/** Saying a movement was recorded (with Undo), and undoing one from a list (asking first). */
export function useMovementFeedback() {
  const { revertMovement } = useWealth();
  const { openDialog, toast } = useUi();
  const tAll = useT();
  const t = tAll.movements;

  const undoNow = async (m: Movement) => {
    try {
      await revertMovement(m.id);
    } catch (e) {
      toast.error(errorMessage(e, t.undoFailed));
      return;
    }
    toast.success(t.undone);
  };

  return {
    recorded: (m: Movement) =>
      toast.success(t.recorded(kindLabel(m.kind)), { action: { label: tAll.common.undo, onClick: () => undoNow(m) } }),
    confirmUndo: (m: Movement) =>
      openDialog((close) => (
        <ConfirmDialog
          title={t.undoTitle}
          message={`${summary(m)} ${undoSentence(m)}`}
          confirmLabel={tAll.common.undo}
          busyLabel={tAll.common.undoing}
          tone="primary"
          failureMessage={t.undoFailed}
          onClose={close}
          onConfirm={async () => {
            await revertMovement(m.id);
            toast.success(t.undone);
          }}
        />
      )),
  };
}
