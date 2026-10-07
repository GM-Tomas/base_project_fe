'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { Combobox } from '@/components/ui/Combobox';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { FormError } from '@/components/ui/FormError';
import { DateInput } from '@/components/ui/DateInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PercentInput } from '@/components/ui/PercentInput';
import { ApiError, errorMessage } from '@/lib/apiError';
import type { HoldingPatch } from '@/lib/api';
import type { Holding, ValueChangeReason } from '@/types/wealth';
import { formatUsd, parseAmount } from '@/lib/money';
import { normalizeLabel, platformKey } from '@/lib/labels';
import { dateProblem, occurredAtFor, today } from '@/lib/movements';
import { parsePercent } from '@/lib/returns';
import { messages, useT } from '@/lib/i18n';

// What the platform field says about what's typed: nothing for an existing platform, which one it is when
// only the case differs (the API keeps the existing spelling), or that it's new.
export function platformHint(typed: string, platforms: string[]): string | null {
  const name = normalizeLabel(typed);
  if (!name || platforms.includes(name)) return null;
  const match = platforms.find((p) => platformKey(p) === platformKey(name));
  return match ? messages().holdingForm.matches(match) : messages().holdingForm.newPlatform;
}

// Classes match exactly, as in the API ("Crypto" and "crypto" are two classes).
export function classHint(typed: string, classes: string[]): string | null {
  const name = normalizeLabel(typed);
  return !name || classes.includes(name) ? null : messages().holdingForm.newClass;
}

const REASONS: ValueChangeReason[] = ['MARKET', 'CASH_FLOW', 'CORRECTION'];

/** What a new value will be recorded as, for this reason. */
export function reasonHint(reason: ValueChangeReason, previous: number, next: number): string {
  const t = messages().holdingForm;
  const by = formatUsd(Math.abs(next - previous));
  const up = next > previous;
  if (reason === 'CORRECTION') return t.asCorrection(by);
  if (reason === 'CASH_FLOW') return up ? t.asDeposit(by) : t.asWithdrawal(by);
  return up ? t.asGain(by) : t.asLoss(by);
}

export interface HoldingFormDialogProps {
  onClose: () => void;
  /** Fills in the platform ("Add asset here" on a platform). */
  platform?: string;
  /** The holding to edit; without it, the dialog adds one. */
  holding?: Holding;
}

// What the edit form changes: the fields that differ from the holding, as the API would store them. A new
// value says what it was (a market move unless told otherwise) and when (now unless another day is picked).
function changes(
  holding: Holding,
  fields: { name: string; platform: string; assetClass: string; value: string; reason: ValueChangeReason; date: string; returnPct: string },
): HoldingPatch {
  const patch: HoldingPatch = {};
  const pct = parsePercent(fields.returnPct);
  if (pct.error === undefined && pct.value !== holding.expectedReturnPct) patch.expectedReturnPct = pct.value;
  if (normalizeLabel(fields.name) !== holding.name) patch.name = fields.name.trim();
  if (normalizeLabel(fields.assetClass) !== holding.assetClass) patch.assetClass = fields.assetClass.trim();
  if (normalizeLabel(fields.platform) !== holding.platform) patch.platform = fields.platform.trim();
  const amount = parseAmount(fields.value);
  if (amount.value !== undefined && amount.value !== holding.valueUsd) {
    patch.valueUsd = amount.value;
    if (fields.reason !== 'MARKET') patch.valueChangeReason = fields.reason;
    const occurredAt = occurredAtFor(fields.date);
    if (occurredAt) patch.occurredAt = occurredAt;
  }
  return patch;
}

export function HoldingFormDialog({ onClose, platform: presetPlatform = '', holding }: HoldingFormDialogProps) {
  const { addHolding, updateHolding, refresh, platforms, availableAssetClasses } = useWealth();
  const { toast } = useUi();
  const nameId = useId();
  const tAll = useT();
  const t = tAll.holdingForm;

  const [name, setName] = useState(holding?.name ?? '');
  const [platform, setPlatform] = useState(holding?.platform ?? presetPlatform);
  const [assetClass, setAssetClass] = useState(holding?.assetClass ?? '');
  const [value, setValue] = useState(holding ? String(holding.valueUsd) : '');
  const [returnPct, setReturnPct] = useState(holding?.expectedReturnPct != null ? String(holding.expectedReturnPct) : '');
  const [reason, setReason] = useState<ValueChangeReason>('MARKET');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const platformNames = platforms.map((p) => p.name);
  const patch = holding && changes(holding, { name, platform, assetClass, value, reason, date, returnPct });
  const newValue = patch?.valueUsd;
  const parsedReturn = parsePercent(returnPct);
  // Editing, Save waits for something to change (an amount or a return it can't read counts: Save says
  // what's wrong).
  const unchanged =
    !!patch && Object.keys(patch).length === 0 && parseAmount(value).error === undefined && parsedReturn.error === undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(value);
    const problem = !name.trim()
      ? t.enterName
      : !platform.trim()
        ? t.enterPlatform
        : !assetClass.trim()
          ? t.enterClass
          : !value.trim()
            ? t.enterValue
            : (amount.error ??
              (parsedReturn.error !== undefined ? t.expectedReturnProblem(parsedReturn.error) : undefined) ??
              (newValue !== undefined ? dateProblem(date) : undefined));
    if (problem !== undefined) {
      setError(problem);
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      if (holding) {
        await updateHolding(holding.id, patch!);
      } else {
        await addHolding({
          name: name.trim(),
          assetClass: assetClass.trim(),
          platform: platform.trim(),
          valueUsd: amount.value!,
          ...(parsedReturn.value != null && { expectedReturnPct: parsedReturn.value }),
        });
      }
    } catch (err) {
      setError(errorMessage(err, t.saveFailed));
      setIsSaving(false);
      // Gone (removed from another device, say): what's on screen is out of date.
      if (err instanceof ApiError && err.status === 404) refresh().catch(() => {});
      return;
    }
    toast.success(holding ? tAll.common.changesSaved : t.added);
    onClose();
  };

  return (
    <Modal title={holding ? t.titleEdit : t.titleAdd} onClose={onClose} busy={isSaving}>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="field">
          <label htmlFor={nameId}>{tAll.common.name}</label>
          <input
            id={nameId}
            className="input"
            type="text"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-grid-2">
          <Combobox
            label={tAll.common.platform}
            placeholder={t.platformPlaceholder}
            value={platform}
            onChange={setPlatform}
            options={platformNames}
            hint={platformHint(platform, platformNames)}
          />
          <Combobox
            label={tAll.common.assetClass}
            placeholder={t.classPlaceholder}
            value={assetClass}
            onChange={setAssetClass}
            options={availableAssetClasses}
            hint={classHint(assetClass, availableAssetClasses)}
          />
        </div>

        <div className="form-grid-2">
          <MoneyInput label={t.value} value={value} onChange={setValue} />
          <PercentInput label={t.expectedReturn} value={returnPct} onChange={setReturnPct} hint={t.returnHint} />
        </div>

        {holding && newValue !== undefined && (
          <div className="form-reason">
            <SegmentedControl
              label={t.whatsThisChange}
              showLabel
              options={REASONS.map((r) => ({ value: r, label: t.reasons[r] }))}
              value={reason}
              onChange={setReason}
              hint={reasonHint(reason, holding.valueUsd, newValue)}
            />
            <div className="form-grid-2">
              <DateInput label={tAll.common.when} value={date} onChange={setDate} />
            </div>
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving || unchanged}>
            {isSaving ? tAll.common.saving : holding ? tAll.common.saveChanges : t.saveAsset}
          </button>
        </div>
      </form>
    </Modal>
  );
}
