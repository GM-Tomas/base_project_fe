'use client';

import React, { useEffect } from 'react';
import { ArrowLeftRight, Diff, Pencil, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { ActivityList } from '@/components/activity/ActivityList';
import { ClassTag } from '@/components/ui/ClassTag';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { formatUsd } from '@/lib/money';
import { formatDay } from '@/lib/movements';
import { formatReturn } from '@/lib/returns';
import { useT } from '@/lib/i18n';
import type { Holding } from '@/types/wealth';
import { useHoldingActions } from './useHoldingActions';

// One holding in a panel along the right edge: what it is and is worth, what can be done with it, and
// what happened to it. It follows the holding through refreshes, and closes once it's gone.
export function HoldingDrawer({ holdingId, onClose }: { holdingId: string; onClose: () => void }) {
  const { holdings, openPlatform, platformLook } = useWealth();
  const actions = useHoldingActions();
  const t = useT();
  const holding = holdings.find((h) => h.id === holdingId);

  useEffect(() => {
    if (!holding) onClose();
  }, [holding, onClose]);

  if (!holding) return null;
  return (
    <Modal title={holding.name} onClose={onClose} variant="drawer">
      <div className="drawer-meta">
        <button
          type="button"
          className="link-btn with-avatar"
          title={t.common.open(holding.platform)}
          onClick={() => {
            onClose();
            openPlatform(holding.platform);
          }}
        >
          <PlatformAvatar {...platformLook(holding.platform)} size={18} />
          {holding.platform}
        </button>
        <ClassTag name={holding.assetClass} />
      </div>
      <div>
        <div className="drawer-value">{formatUsd(holding.valueUsd)}</div>
        <div className="text-muted drawer-dates">
          {t.holding.added(formatDay(holding.createdAt), formatDay(holding.updatedAt))}
        </div>
        <div className="drawer-return">
          {holding.effectiveReturnPct === null ? (
            <>
              {t.holding.noReturn}{' '}
              <button type="button" className="link-btn link-accent" onClick={() => actions.edit(holding)}>
                {t.holding.setOne}
              </button>
            </>
          ) : (
            <>
              {holding.effectiveReturnPct < 0
                ? t.holding.lose(formatReturn(-holding.effectiveReturnPct, 2))
                : t.holding.grow(formatReturn(holding.effectiveReturnPct, 2))}
              {holding.expectedReturnPct === null && <span className="text-muted">{t.holding.fromClass(holding.assetClass)}</span>}
            </>
          )}
        </div>
      </div>
      <div className="drawer-actions">
        <button type="button" className="btn btn-primary" onClick={() => actions.record(holding)}>
          <Diff size={14} aria-hidden />
          {t.assets.recordChange}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.transfer({ holding })}>
          <ArrowLeftRight size={14} aria-hidden />
          {t.assets.transfer}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.edit(holding)}>
          <Pencil size={14} aria-hidden />
          {t.common.edit}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => actions.remove(holding)}>
          <Trash2 size={14} aria-hidden />
          {t.common.remove}
        </button>
      </div>
      <h3 className="section-title">{t.holding.activity}</h3>
      <ActivityList holdingId={holding.id} empty={t.holding.nothingYet} />
    </Modal>
  );
}

/** Opens a holding's panel. */
export function useOpenHolding() {
  const { openDialog } = useUi();
  return (h: Holding) => openDialog((close) => <HoldingDrawer holdingId={h.id} onClose={close} />);
}

/**
 * A click anywhere on a holding's row opens it (its own buttons aside). Focus goes to the row's name button
 * first, so that's where it comes back when the panel closes.
 */
export function useOpenFromRow() {
  const open = useOpenHolding();
  return (e: React.MouseEvent<HTMLElement>, h: Holding) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    e.currentTarget.querySelector<HTMLElement>('[data-holding-name]')?.focus();
    open(h);
  };
}
