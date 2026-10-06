'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import { PercentInput } from '@/components/ui/PercentInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { errorMessage } from '@/lib/apiError';
import type { AssetClassPatch } from '@/lib/api';
import { assetClassColor } from '@/lib/constants';
import { MAX_CLASS_NAME } from '@/lib/customization';
import { normalizeLabel } from '@/lib/labels';
import { parsePercent } from '@/lib/returns';
import type { AssetClassInfo } from '@/types/wealth';

export interface ClassFormDialogProps {
  onClose: () => void;
  /** The class to edit; without it, the dialog creates one. */
  assetClass?: AssetClassInfo;
}

const LIQUIDITY = [
  { value: 'yes', label: 'Ready to spend' },
  { value: 'no', label: 'Locked in' },
] as const;

const assets = (n: number) => `${n} ${n === 1 ? 'asset' : 'assets'}`;

/** "Merge Stocks into Equity? Its 3 assets move to Equity." */
export function mergeMessage(from: AssetClassInfo, into: AssetClassInfo): string {
  const n = from.holdingsCount;
  const moving = n === 0 ? 'It has no assets.' : n === 1 ? `Its asset moves to ${into.name}.` : `Its ${assets(n)} move to ${into.name}.`;
  return `Merge ${from.name} into ${into.name}? ${moving} ${into.name} keeps its own color and settings.`;
}

// A new class, or editing one: its name, color, whether it counts as ready to spend and the return its
// assets without one of their own count with. Renaming one onto another class merges them, once confirmed.
export function ClassFormDialog({ onClose, assetClass }: ClassFormDialogProps) {
  const { assetClassInfos, createAssetClass, updateAssetClass } = useWealth();
  const { toast, openDialog } = useUi();
  const nameId = useId();

  const [name, setName] = useState(assetClass?.name ?? '');
  const [color, setColor] = useState<string | null>(assetClass?.color ?? null);
  const [liquid, setLiquid] = useState<'yes' | 'no'>(assetClass?.liquid ? 'yes' : 'no');
  const [returnText, setReturnText] = useState(assetClass?.expectedReturnPct != null ? String(assetClass.expectedReturnPct) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const typed = normalizeLabel(name);
  const parsedReturn = parsePercent(returnText);
  // Another of the user's classes with that name (classes tell case apart, as the API does).
  const existing = assetClassInfos.find((c) => c.name === typed && c.name !== assetClass?.name);

  const patch = (): AssetClassPatch => {
    const p: AssetClassPatch = {};
    if (!assetClass) return p;
    if (typed !== assetClass.name) p.name = typed;
    if (color !== assetClass.color) p.color = color;
    if ((liquid === 'yes') !== assetClass.liquid) p.liquid = liquid === 'yes';
    if (parsedReturn.error === undefined && parsedReturn.value !== assetClass.expectedReturnPct) p.expectedReturnPct = parsedReturn.value;
    return p;
  };
  const unchanged = !!assetClass && Object.keys(patch()).length === 0 && parsedReturn.error === undefined;

  const problem = () =>
    !typed
      ? 'Please enter a name'
      : [...typed].length > MAX_CLASS_NAME
        ? `Keep the name under ${MAX_CLASS_NAME} characters`
        : !assetClass && existing
          ? `You already have a class named ${typed}`
          : parsedReturn.error
            ? `Default return: ${parsedReturn.error}`
            : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const wrong = problem();
    if (wrong) {
      setError(wrong);
      return;
    }
    if (assetClass && existing) {
      // Onto a class they have: a merge, once they say so (the rest of the form is left out).
      openDialog((close) => (
        <ConfirmDialog
          title={`Merge into ${existing.name}?`}
          message={mergeMessage(assetClass, existing)}
          confirmLabel="Merge"
          busyLabel="Merging…"
          tone="primary"
          failureMessage="Could not merge these classes. Please try again."
          onConfirm={async () => {
            await updateAssetClass(assetClass.id, { name: existing.name, mergeIfExists: true });
            toast.success(`Merged into ${existing.name}`);
            onClose();
          }}
          onClose={close}
        />
      ));
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (assetClass) {
        await updateAssetClass(assetClass.id, patch());
      } else {
        await createAssetClass({
          name: typed,
          color,
          liquid: liquid === 'yes',
          ...(parsedReturn.value != null && { expectedReturnPct: parsedReturn.value }),
        });
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save this class. Please try again.'));
      setSaving(false);
      return;
    }
    toast.success(assetClass ? 'Changes saved' : `${typed} added`);
    onClose();
  };

  const renaming = !!assetClass && typed !== assetClass.name && !!typed;
  const nameHint = existing
    ? assetClass
      ? `${existing.name} already exists: saving merges ${assetClass.name} into it.`
      : null
    : renaming && assetClass.holdingsCount > 0
      ? `Renames it on its ${assets(assetClass.holdingsCount)}.`
      : null;

  return (
    <Modal title={assetClass ? `Edit ${assetClass.name}` : 'New class'} onClose={onClose} busy={saving}>
      {error && <FormError>{error}</FormError>}
      <form onSubmit={save} noValidate className="dialog-form">
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            className="input"
            type="text"
            autoComplete="off"
            placeholder="e.g. Real Estate"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={nameHint ? `${nameId}-hint` : undefined}
          />
          {nameHint && (
            <div id={`${nameId}-hint`} className="field-hint">
              {nameHint}
            </div>
          )}
        </div>

        <ColorPicker label="Color" value={color} onChange={setColor} defaultColor={assetClassColor(assetClass?.name ?? typed)} />

        <SegmentedControl
          label="Liquidity"
          showLabel
          options={[...LIQUIDITY]}
          value={liquid}
          onChange={setLiquid}
          hint={liquid === 'yes' ? 'Counts in "Ready to spend" on the dashboard.' : "Doesn't count as ready to spend."}
        />

        <PercentInput
          label="Default return (% a year, optional)"
          value={returnText}
          onChange={setReturnText}
          hint="Its assets without a return of their own count with this one."
        />

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || unchanged}>
            {saving ? 'Saving…' : assetClass ? (existing ? 'Merge…' : 'Save changes') : 'Add class'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
