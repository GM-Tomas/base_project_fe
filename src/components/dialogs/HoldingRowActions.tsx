'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { useT } from '@/lib/i18n';
import type { Holding } from '@/types/wealth';
import { useHoldingActions } from './useHoldingActions';

/** A holding row's ⋯: record a change, transfer from it, edit, remove (the row itself opens its panel). */
export function HoldingRowActions({ holding: h }: { holding: Holding }) {
  const actions = useHoldingActions();
  const t = useT();
  return (
    <Menu
      label={t.common.actionsFor(h.name)}
      iconOnly
      buttonClassName="icon-btn"
      groups={[
        [
          { label: t.assets.recordChange, run: () => actions.record(h) },
          { label: t.assets.transfer, run: () => actions.transfer({ holding: h }) },
          { label: t.common.edit, run: () => actions.edit(h) },
        ],
        [{ label: t.common.remove, tone: 'danger', run: () => actions.remove(h) }],
      ]}
    >
      <MoreHorizontal size={16} aria-hidden />
    </Menu>
  );
}
