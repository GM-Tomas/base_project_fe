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
import { messages, useT } from '@/lib/i18n';

export interface ClassFormDialogProps {
  onClose: () => void;
  /** The class to edit; without it, the dialog creates one. */
  assetClass?: AssetClassInfo;
}

/** "Merge Stocks into Equity? Its 3 assets move to Equity." */
export function mergeMessage(from: AssetClassInfo, into: AssetClassInfo): string {
  const t = messages().classForm;
  const n = from.holdingsCount;
  const moving = n === 0 ? t.noAssets : n === 1 ? t.itsAssetMoves(into.name) : t.itsAssetsMove(n, into.name);
  return t.merge(from.name, into.name, moving);
}

// A new class, or editing one: its name, color, whether it counts as ready to spend and the return its
// assets without one of their own count with. Renaming one onto another class merges them, once confirmed.
export function ClassFormDialog({ onClose, assetClass }: ClassFormDialogProps) {
  const { assetClassInfos, createAssetClass, updateAssetClass } = useWealth();
  const { toast, openDialog } = useUi();
  const nameId = useId();
  const tAll = useT();
  const t = tAll.classForm;

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
      ? t.enterName
      : [...typed].length > MAX_CLASS_NAME
        ? t.nameTooLong(MAX_CLASS_NAME)
        : !assetClass && existing
          ? t.exists(typed)
          : parsedReturn.error
            ? t.defaultReturnProblem(parsedReturn.error)
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
          title={tAll.common.mergeInto(existing.name)}
          message={mergeMessage(assetClass, existing)}
          confirmLabel={tAll.common.merge}
          busyLabel={tAll.common.merging}
          tone="primary"
          failureMessage={t.mergeFailed}
          onConfirm={async () => {
            await updateAssetClass(assetClass.id, { name: existing.name, mergeIfExists: true });
            toast.success(tAll.common.mergedInto(existing.name));
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
      setError(errorMessage(err, t.saveFailed));
      setSaving(false);
      return;
    }
    toast.success(assetClass ? tAll.common.changesSaved : t.added(typed));
    onClose();
  };

  const renaming = !!assetClass && typed !== assetClass.name && !!typed;
  const nameHint = existing
    ? assetClass
      ? t.existsHint(existing.name, assetClass.name)
      : null
    : renaming && assetClass.holdingsCount > 0
      ? t.renames(assetClass.holdingsCount)
      : null;

  return (
    <Modal title={assetClass ? tAll.common.edited(assetClass.name) : t.titleNew} onClose={onClose} busy={saving}>
      {error && <FormError>{error}</FormError>}
      <form onSubmit={save} noValidate className="dialog-form">
        <div className="field">
          <label htmlFor={nameId}>{tAll.common.name}</label>
          <input
            id={nameId}
            className="input"
            type="text"
            autoComplete="off"
            placeholder={t.namePlaceholder}
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

        <ColorPicker label={t.color} value={color} onChange={setColor} defaultColor={assetClassColor(assetClass?.name ?? typed)} />

        <SegmentedControl
          label={t.liquidity}
          showLabel
          options={[
            { value: 'yes' as const, label: tAll.settings.ready },
            { value: 'no' as const, label: tAll.settings.locked },
          ]}
          value={liquid}
          onChange={setLiquid}
          hint={liquid === 'yes' ? t.readyHint : t.lockedHint}
        />

        <PercentInput label={t.defaultReturn} value={returnText} onChange={setReturnText} hint={t.defaultReturnHint} />

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || unchanged}>
            {saving ? tAll.common.saving : assetClass ? (existing ? tAll.common.mergeEllipsis : tAll.common.saveChanges) : t.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
