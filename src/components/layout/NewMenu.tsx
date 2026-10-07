'use client';

import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useQuickActions } from '@/components/app/useQuickActions';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { useT } from '@/lib/i18n';

// The header's New ▾: what can be added or recorded from anywhere, with the key that does it.
export function NewMenu() {
  const { holdings, debts } = useWealth();
  const actions = useQuickActions();
  const t = useT().newMenu;
  const noAssets = holdings.length ? undefined : t.addAssetFirst;

  const groups: MenuItem[][] = [
    [
      { label: t.asset, shortcut: 'N', run: actions.asset },
      { label: t.gainOrLoss, shortcut: 'G', run: actions.gainLoss, unavailable: noAssets },
      { label: t.transfer, shortcut: 'T', run: actions.transfer, unavailable: noAssets },
      { label: t.debt, shortcut: 'D', run: actions.debt },
      { label: t.debtPayment, run: actions.debtPayment, unavailable: debts.length ? undefined : t.noDebtsYet },
      { label: t.checkpoint, shortcut: 'S', run: () => void actions.checkpoint() },
    ],
    [{ label: t.shortcuts, shortcut: '?', run: actions.shortcuts }],
  ];

  return (
    <div className="new-menu">
      <Menu label={t.title} buttonClassName="btn btn-primary" groups={groups}>
        <Plus size={14} strokeWidth={2.2} aria-hidden />
        {t.title}
        <ChevronDown size={14} aria-hidden />
      </Menu>
    </div>
  );
}
