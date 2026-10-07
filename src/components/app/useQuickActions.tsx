'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { errorMessage } from '@/lib/apiError';
import { formatUsd } from '@/lib/money';
import { amountsHidden, setAmountsHidden } from '@/lib/privacy';
import { ASSETS_SEARCH_ID } from '@/lib/assetsTable';
import { HoldingFormDialog } from '@/components/dialogs/HoldingFormDialog';
import { RecordChangeDialog } from '@/components/dialogs/RecordChangeDialog';
import { TransferDialog } from '@/components/dialogs/TransferDialog';
import { DebtFormDialog } from '@/components/dialogs/DebtFormDialog';
import { DebtPaymentDialog } from '@/components/dialogs/DebtPaymentDialog';
import { PickDialog } from '@/components/dialogs/PickDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useT } from '@/lib/i18n';

// What can be done from anywhere: the header's New menu and the keyboard shortcuts. Something about one
// asset or debt asks which first (unless there's only one); with none, it says what's missing.
export function useQuickActions() {
  const { holdings, debts, takeSnapshot, setView } = useWealth();
  const { openDialog, toast } = useUi();
  const tAll = useT();
  const t = tAll.quick;
  const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const gainLoss = () => {
    if (!holdings.length) return toast.error(t.assetFirstForGains);
    const record = (id: string) =>
      openDialog((close) => <RecordChangeDialog holding={holdings.find((h) => h.id === id)!} onClose={close} />);
    if (holdings.length === 1) return void record(holdings[0].id);
    openDialog((close) => (
      <PickDialog
        title={t.recordGainOrLoss}
        label={t.onWhichAsset}
        options={byName(holdings).map((h) => ({ value: h.id, label: `${h.name} · ${h.platform} · ${formatUsd(h.valueUsd)}` }))}
        onPick={(id) => {
          close();
          record(id);
        }}
        onClose={close}
      />
    ));
  };

  const debtPayment = () => {
    if (!debts.length) return toast.error(t.noDebtsToPay);
    const pay = (id: string) => openDialog((close) => <DebtPaymentDialog debt={debts.find((d) => d.id === id)!} onClose={close} />);
    if (debts.length === 1) return void pay(debts[0].id);
    openDialog((close) => (
      <PickDialog
        title={t.payADebt}
        label={t.whichDebt}
        options={byName(debts).map((d) => ({ value: d.id, label: `${d.name}${d.lender ? ` · ${d.lender}` : ''} · ${formatUsd(d.balanceUsd)}` }))}
        onPick={(id) => {
          close();
          pay(id);
        }}
        onClose={close}
      />
    ));
  };

  return {
    asset: () => void openDialog((close) => <HoldingFormDialog onClose={close} />),
    gainLoss,
    transfer: () =>
      holdings.length
        ? void openDialog((close) => <TransferDialog onClose={close} />)
        : toast.error(t.assetFirstForTransfer),
    debt: () => void openDialog((close) => <DebtFormDialog onClose={close} />),
    debtPayment,
    checkpoint: async () => {
      try {
        await takeSnapshot();
        toast.success(tAll.snapshot.saved);
      } catch (e) {
        toast.error(errorMessage(e, tAll.snapshot.failed));
      }
    },
    searchAssets: () => {
      setView('assets');
      // Once Assets is on screen.
      setTimeout(() => document.getElementById(ASSETS_SEARCH_ID)?.focus(), 0);
    },
    togglePrivacy: () => setAmountsHidden(!amountsHidden()),
    shortcuts: () => void openDialog((close) => <ShortcutsDialog onClose={close} />),
  };
}

export type QuickActions = ReturnType<typeof useQuickActions>;
