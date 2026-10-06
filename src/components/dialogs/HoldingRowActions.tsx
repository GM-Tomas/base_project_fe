'use client';

import React from 'react';
import { ArrowLeftRight, Diff, Pencil, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import type { Holding } from '@/types/wealth';
import { useHoldingActions } from './useHoldingActions';

/** A holding row's buttons: record a change, transfer from it, edit, remove (on a phone, only the first: the row opens the rest). */
export function HoldingRowActions({ holding: h }: { holding: Holding }) {
  const actions = useHoldingActions();
  return (
    <div className="row-actions holding-actions">
      <IconButton label={`Record a change to ${h.name}`} onClick={() => actions.record(h)}>
        <Diff size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Transfer from ${h.name}`} onClick={() => actions.transfer({ holding: h })}>
        <ArrowLeftRight size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Edit ${h.name}`} onClick={() => actions.edit(h)}>
        <Pencil size={15} aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${h.name}`} tone="danger" onClick={() => actions.remove(h)}>
        <Trash2 size={15} aria-hidden />
      </IconButton>
    </div>
  );
}
