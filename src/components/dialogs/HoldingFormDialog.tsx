'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { Combobox } from '@/components/ui/Combobox';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { FormError } from '@/components/ui/FormError';
import { ApiError, errorMessage } from '@/lib/apiError';
import type { HoldingPatch } from '@/lib/api';
import type { Holding } from '@/types/wealth';
import { parseAmount } from '@/lib/money';
import { normalizeLabel, platformKey } from '@/lib/labels';

// What the platform field says about what's typed: nothing for an existing platform, which one it is when
// only the case differs (the API keeps the existing spelling), or that it's new.
export function platformHint(typed: string, platforms: string[]): string | null {
  const name = normalizeLabel(typed);
  if (!name || platforms.includes(name)) return null;
  const match = platforms.find((p) => platformKey(p) === platformKey(name));
  return match ? `Matches ${match}` : 'New platform — it will be created';
}

// Classes match exactly, as in the API ("Crypto" and "crypto" are two classes).
export function classHint(typed: string, classes: string[]): string | null {
  const name = normalizeLabel(typed);
  return !name || classes.includes(name) ? null : 'New class — it will be created';
}

export interface HoldingFormDialogProps {
  onClose: () => void;
  /** Fills in the platform ("Add asset here" on a platform). */
  platform?: string;
  /** The holding to edit; without it, the dialog adds one. */
  holding?: Holding;
}

// What the edit form changes: the fields that differ from the holding, as the API would store them.
function changes(holding: Holding, fields: { name: string; platform: string; assetClass: string; value: string }): HoldingPatch {
  const patch: HoldingPatch = {};
  if (normalizeLabel(fields.name) !== holding.name) patch.name = fields.name.trim();
  if (normalizeLabel(fields.assetClass) !== holding.assetClass) patch.assetClass = fields.assetClass.trim();
  if (normalizeLabel(fields.platform) !== holding.platform) patch.platform = fields.platform.trim();
  const amount = parseAmount(fields.value);
  if (amount.value !== undefined && amount.value !== holding.valueUsd) patch.valueUsd = amount.value;
  return patch;
}

export function HoldingFormDialog({ onClose, platform: presetPlatform = '', holding }: HoldingFormDialogProps) {
  const { addHolding, updateHolding, refresh, platforms, availableAssetClasses } = useWealth();
  const { toast } = useUi();
  const nameId = useId();

  const [name, setName] = useState(holding?.name ?? '');
  const [platform, setPlatform] = useState(holding?.platform ?? presetPlatform);
  const [assetClass, setAssetClass] = useState(holding?.assetClass ?? '');
  const [value, setValue] = useState(holding ? String(holding.valueUsd) : '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const platformNames = platforms.map((p) => p.name);
  const patch = holding && changes(holding, { name, platform, assetClass, value });
  // Editing, Save waits for something to change (an amount it can't read counts: Save says what's wrong).
  const unchanged = !!patch && Object.keys(patch).length === 0 && parseAmount(value).error === undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(value);
    const problem = !name.trim()
      ? 'Please enter an asset name'
      : !platform.trim()
        ? 'Please choose or enter a platform'
        : !assetClass.trim()
          ? 'Please choose or enter an asset class'
          : !value.trim()
            ? 'Please enter a value'
            : amount.error;
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
        });
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save this asset. Please try again.'));
      setIsSaving(false);
      // Gone (removed from another device, say): what's on screen is out of date.
      if (err instanceof ApiError && err.status === 404) refresh().catch(() => {});
      return;
    }
    toast.success(holding ? 'Changes saved' : 'Asset added');
    onClose();
  };

  return (
    <Modal title={holding ? 'Edit asset' : 'Add an asset'} onClose={onClose} busy={isSaving}>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            className="input"
            type="text"
            placeholder="e.g. Vanguard S&P 500 ETF"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-grid-2">
          <Combobox
            label="Platform"
            placeholder="e.g. Interactive Brokers"
            value={platform}
            onChange={setPlatform}
            options={platformNames}
            hint={platformHint(platform, platformNames)}
          />
          <Combobox
            label="Asset class"
            placeholder="e.g. Index Fund"
            value={assetClass}
            onChange={setAssetClass}
            options={availableAssetClasses}
            hint={classHint(assetClass, availableAssetClasses)}
          />
        </div>

        <MoneyInput label="Value (USD)" value={value} onChange={setValue} />

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving || unchanged}>
            {isSaving ? 'Saving…' : holding ? 'Save changes' : 'Save asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
