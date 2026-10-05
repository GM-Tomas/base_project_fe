'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { Combobox } from '@/components/ui/Combobox';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { FormError } from '@/components/ui/FormError';
import { errorMessage } from '@/lib/apiError';
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
}

export function HoldingFormDialog({ onClose, platform: presetPlatform = '' }: HoldingFormDialogProps) {
  const { addHolding, platforms, availableAssetClasses } = useWealth();
  const { toast } = useUi();
  const nameId = useId();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState(presetPlatform);
  const [assetClass, setAssetClass] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const platformNames = platforms.map((p) => p.name);

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
      await addHolding({
        name: name.trim(),
        assetClass: assetClass.trim(),
        platform: platform.trim(),
        valueUsd: amount.value!,
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not save this asset. Please try again.'));
      setIsSaving(false);
      return;
    }
    toast.success('Asset added');
    onClose();
  };

  return (
    <Modal title="Add an asset" onClose={onClose} busy={isSaving}>
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
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
