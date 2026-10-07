'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CircleMinus,
  CirclePlus,
  CreditCard,
  HandCoins,
  Percent,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { formatUsd } from '@/lib/money';
import { amountOf, describe, formatDay, kindLabel, type Scope } from '@/lib/movements';
import { useT } from '@/lib/i18n';
import { IconButton } from '@/components/ui/IconButton';
import { useMovementFeedback } from '@/components/dialogs/useMovementFeedback';
import type { Movement, MovementKind } from '@/types/wealth';

const ICONS: Record<MovementKind, LucideIcon> = {
  OPENING: CirclePlus,
  CLOSING: CircleMinus,
  GAIN: TrendingUp,
  LOSS: TrendingDown,
  DEPOSIT: ArrowDownToLine,
  WITHDRAWAL: ArrowUpFromLine,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: Wrench,
  DEBT_PAYMENT: HandCoins,
  DEBT_CHARGE: CreditCard,
  DEBT_INTEREST: Percent,
};

export const PAGE_SIZE = 50;

export interface ActivityListProps {
  /** One holding's activity, with amounts as they changed it; everything's otherwise. */
  holdingId?: string;
  /** One debt's activity, with amounts as they changed what's owed. */
  debtId?: string;
  kinds?: MovementKind[];
  /** Only what happened within [from, to] (instants, ISO). */
  from?: string;
  to?: string;
  /** What to say when there's nothing (to show). */
  empty?: string;
}

type Loaded = { items: Movement[]; next: string | null };

// The activity log, newest first, a page at a time. It reloads whenever the app's data does (after any
// change, here or in a dialog), so it never disagrees with the values on screen.
export function ActivityList({ holdingId, debtId, kinds, from, to, empty }: ActivityListProps) {
  const { dataVersion } = useWealth();
  const t = useT();
  const { confirmUndo } = useMovementFeedback();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Each reload starts a new generation: a page asked for by an earlier one is dropped.
  const generation = useRef(0);
  const kindsKey = kinds?.join(',') ?? '';

  useEffect(() => {
    const current = ++generation.current;
    setError('');
    setLoadingMore(false);
    api
      .getMovements({ holdingId, debtId, kinds: kindsKey ? (kindsKey.split(',') as MovementKind[]) : undefined, from, to, limit: PAGE_SIZE })
      .then((page) => {
        if (current === generation.current) setLoaded({ items: page.items, next: page.nextCursor });
      })
      .catch((e) => {
        if (current === generation.current) setError(errorMessage(e, t.activity.loadFailed));
      });
  }, [holdingId, debtId, kindsKey, from, to, dataVersion, attempt]);

  const loadMore = async () => {
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await api.getMovements({ holdingId, debtId, kinds, from, to, limit: PAGE_SIZE, cursor: loaded!.next! });
      if (current !== generation.current) return;
      setLoaded((list) => ({ items: [...list!.items, ...page.items], next: page.nextCursor }));
    } catch (e) {
      if (current === generation.current) setError(errorMessage(e, t.activity.loadMoreFailed));
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  };

  if (error && !loaded) {
    return (
      <div className="activity-message" role="alert">
        {error}{' '}
        <button type="button" className="link-btn link-accent" onClick={() => setAttempt((n) => n + 1)}>
          {t.common.retry}
        </button>
      </div>
    );
  }
  if (!loaded) return <div className="activity-message">{t.activity.loading}</div>;
  if (loaded.items.length === 0) return <div className="activity-message">{empty ?? t.activity.none}</div>;

  return (
    <div>
      <ul className="activity-list" aria-label={t.activity.list}>
        {loaded.items.map((m) => (
          <ActivityRow key={m.id} movement={m} scope={{ holdingId, debtId }} onUndo={() => confirmUndo(m)} />
        ))}
      </ul>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
      {loaded.next && (
        <div className="activity-more">
          <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t.activity.loadingMore : t.activity.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ movement: m, scope, onUndo }: { movement: Movement; scope: Scope; onUndo: () => void }) {
  const Icon = ICONS[m.kind];
  const { title, details } = describe(m, scope);
  const amount = amountOf(m, scope);
  const t = useT().movements;
  const undoLabel =
    m.kind === 'TRANSFER'
      ? t.undoTransfer(formatUsd(m.amountUsd), m.holding!.name, m.toHolding!.name)
      : t.undoOther(kindLabel(m.kind), formatUsd(m.amountUsd), (m.debt ?? m.holding)!.name);
  return (
    <li className="activity-row">
      <span className={`activity-icon kind-${m.kind.toLowerCase()}`} aria-hidden>
        <Icon size={15} />
      </span>
      <div className="activity-main">
        <div className="activity-title">{title}</div>
        <div className="activity-details">{[formatDay(m.occurredAt), ...details].join(' · ')}</div>
        {m.note && <div className="activity-note">“{m.note}”</div>}
      </div>
      <div className={`activity-amount amount-${amount.tone}`}>{amount.text}</div>
      <div className="activity-action">
        {m.revertible && (
          <IconButton label={undoLabel} onClick={onUndo}>
            <Undo2 size={15} aria-hidden />
          </IconButton>
        )}
      </div>
    </li>
  );
}
