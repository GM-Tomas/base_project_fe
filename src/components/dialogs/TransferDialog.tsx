'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DateInput } from '@/components/ui/DateInput';
import { Combobox } from '@/components/ui/Combobox';
import { FormError } from '@/components/ui/FormError';
import { errorMessage } from '@/lib/apiError';
import { exactUsd, formatUsd, parseAmount } from '@/lib/money';
import { normalizeLabel } from '@/lib/labels';
import { dateProblem, occurredAtFor, today } from '@/lib/movements';
import type { MovementInput } from '@/lib/api';
import type { Holding } from '@/types/wealth';
import { classHint, platformHint } from './HoldingFormDialog';
import { PlatformSelectFrame } from '@/components/ui/PlatformSelectFrame';
import { MAX_NOTE, noteFor, noteProblem } from './RecordChangeDialog';
import { useMovementFeedback } from './useMovementFeedback';

// Choices that aren't a platform or a holding: a destination that doesn't exist yet. Names are typed by
// users, so these can't be mistaken for one (a platform can't be blank).
const NEW = '';
const NEW_PLATFORM = ' new platform';
const NEW_ASSET = ' new asset';

const cents = (n: number) => Math.round(n * 100) / 100;
const byName = (a: Holding, b: Holding) => a.name.localeCompare(b.name);

export interface TransferDialogProps {
  /** Where the money leaves from: a holding, or a platform (its holding is picked if it has just one). */
  from?: Holding;
  platform?: string;
  onClose: () => void;
}

// Money moving from one holding to another, on the same platform or another one, maybe with a fee. Each
// end is picked in two steps, platform then holding; the destination can be a holding that doesn't exist
// yet, which the transfer creates.
export function TransferDialog({ from, platform, onClose }: TransferDialogProps) {
  const { holdings, platforms, availableAssetClasses, recordMovement } = useWealth();
  const { recorded } = useMovementFeedback();
  const ids = { fromPlatform: useId(), fromAsset: useId(), toPlatform: useId(), toAsset: useId(), name: useId(), note: useId() };
  const platformNames = platforms.map((p) => p.name);
  const on = (name: string) => holdings.filter((h) => h.platform === name).sort(byName);
  const onlyOne = (list: Holding[]) => (list.length === 1 ? list[0].id : NEW);

  const startPlatform = from?.platform ?? platform ?? NEW;
  const [fromPlatform, setFromPlatform] = useState(startPlatform);
  const [fromId, setFromId] = useState(from?.id ?? onlyOne(on(startPlatform)));
  const [toPlatform, setToPlatform] = useState(NEW);
  const [toId, setToId] = useState(NEW);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const source = holdings.find((h) => h.id === fromId);
  const toChoices = toPlatform === NEW_PLATFORM ? [] : on(toPlatform).filter((h) => h.id !== fromId);
  const destination = holdings.find((h) => h.id === toId && h.id !== fromId);
  const creating = toPlatform === NEW_PLATFORM || toId === NEW_ASSET;
  const destinationPlatform = toPlatform === NEW_PLATFORM ? normalizeLabel(newPlatform) : toPlatform;

  // A new destination starts as a copy of the source's name and class, as the spec asks: moving "USD cash"
  // to another bank usually keeps both.
  const startNew = (source?: Holding) => {
    setNewName((name) => name || source?.name || '');
    setNewClass((assetClass) => assetClass || source?.assetClass || '');
  };

  // The source and the destination are never the same holding.
  const pickFrom = (id: string) => {
    setFromId(id);
    if (id === toId) setToId(NEW);
  };
  const pickFromPlatform = (name: string) => {
    setFromPlatform(name);
    pickFrom(onlyOne(on(name)));
  };
  const pickToPlatform = (name: string) => {
    setToPlatform(name);
    if (name === NEW_PLATFORM) {
      setToId(NEW);
      startNew(source);
      return;
    }
    const choices = on(name).filter((h) => h.id !== fromId);
    const id = choices.length === 1 ? choices[0].id : choices.length === 0 && name ? NEW_ASSET : NEW;
    setToId(id);
    if (id === NEW_ASSET) startNew(source);
  };
  const pickTo = (id: string) => {
    setToId(id);
    if (id === NEW_ASSET) startNew(source);
  };

  const parsedAmount = amount.trim() ? parseAmount(amount) : null;
  const parsedFee = fee.trim() ? parseAmount(fee) : null;
  const value = parsedAmount?.value;
  const feeValue = parsedFee?.value ?? 0;
  const overdrawn = !!source && value !== undefined && value > source.valueUsd;
  const feeTooBig = value !== undefined && feeValue > value;
  const preview =
    source && value && !overdrawn && !feeTooBig && (destination || creating)
      ? {
          from: `${source.platform} · ${source.name}: ${formatUsd(source.valueUsd)} → ${formatUsd(cents(source.valueUsd - value))}`,
          to: `${destinationPlatform || 'New platform'} · ${destination?.name ?? (normalizeLabel(newName) || 'New asset')}: ${formatUsd(destination?.valueUsd ?? 0)} → ${formatUsd(cents((destination?.valueUsd ?? 0) + value - feeValue))}`,
        }
      : null;

  const problem = () =>
    !source
      ? 'Choose where the money comes from'
      : !destination && !creating
        ? 'Choose where the money goes'
        : creating && !normalizeLabel(newPlatform) && toPlatform === NEW_PLATFORM
          ? 'Please enter the new platform'
          : creating && !normalizeLabel(newName)
            ? 'Please enter a name for the new asset'
            : creating && !normalizeLabel(newClass)
              ? 'Please choose or enter an asset class'
              : !amount.trim()
                ? 'Please enter an amount'
                : (parsedAmount!.error ??
                  (value === 0 ? 'The amount must be more than 0' : undefined) ??
                  parsedFee?.error ??
                  (overdrawn ? `You can transfer up to ${formatUsd(source.valueUsd)} from ${source.name}` : undefined) ??
                  (feeTooBig ? "The fee can't be larger than the amount" : undefined) ??
                  dateProblem(date) ??
                  noteProblem(note));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wrong = problem();
    if (wrong) {
      setError(wrong);
      return;
    }
    const input: MovementInput = {
      kind: 'TRANSFER',
      fromHoldingId: source!.id,
      ...(creating
        ? { toNewHolding: { name: newName.trim(), assetClass: newClass.trim(), platform: destinationPlatform } }
        : { toHoldingId: destination!.id }),
      amountUsd: value!,
      ...(feeValue > 0 && { feeUsd: feeValue }),
      occurredAt: occurredAtFor(date),
      note: noteFor(note),
    };
    setError('');
    setSaving(true);
    let movement;
    try {
      movement = await recordMovement(input);
    } catch (err) {
      setError(errorMessage(err, "Couldn't record this transfer. Please try again."));
      setSaving(false);
      return;
    }
    recorded(movement);
    onClose();
  };

  return (
    <Modal title="Transfer" onClose={onClose} busy={saving} className="dialog-wide">
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <fieldset className="form-group">
          <legend>From</legend>
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor={ids.fromPlatform}>Platform</label>
              <PlatformSelectFrame platform={fromPlatform}>
                <select id={ids.fromPlatform} className="input" value={fromPlatform} onChange={(e) => pickFromPlatform(e.target.value)}>
                  <option value={NEW} disabled>
                    Choose a platform
                  </option>
                  {platformNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </PlatformSelectFrame>
            </div>
            <div className="field">
              <label htmlFor={ids.fromAsset}>Asset</label>
              <select
                id={ids.fromAsset}
                className="input"
                value={fromId}
                disabled={!fromPlatform}
                onChange={(e) => pickFrom(e.target.value)}
              >
                <option value={NEW} disabled>
                  Choose an asset
                </option>
                {on(fromPlatform).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {source && (
            <div className="field-hint">
              Available: {formatUsd(source.valueUsd)}{' '}
              <button type="button" className="link-btn link-accent" onClick={() => setAmount(exactUsd(source.valueUsd))}>
                Max
              </button>
            </div>
          )}
        </fieldset>

        <fieldset className="form-group">
          <legend>To</legend>
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor={ids.toPlatform}>Platform</label>
              <PlatformSelectFrame platform={toPlatform}>
                <select id={ids.toPlatform} className="input" value={toPlatform} onChange={(e) => pickToPlatform(e.target.value)}>
                  <option value={NEW} disabled>
                    Choose a platform
                  </option>
                  {platformNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={NEW_PLATFORM}>A new platform…</option>
                </select>
              </PlatformSelectFrame>
            </div>
            {toPlatform !== NEW_PLATFORM && (
              <div className="field">
                <label htmlFor={ids.toAsset}>Asset</label>
                <select id={ids.toAsset} className="input" value={toId} disabled={!toPlatform} onChange={(e) => pickTo(e.target.value)}>
                  <option value={NEW} disabled>
                    Choose an asset
                  </option>
                  {toChoices.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                  {toPlatform && <option value={NEW_ASSET}>A new asset on {toPlatform}…</option>}
                </select>
              </div>
            )}
            {toPlatform === NEW_PLATFORM && (
              <Combobox
                label="New platform"
                placeholder="e.g. Balanz"
                value={newPlatform}
                onChange={setNewPlatform}
                options={[]}
                hint={platformHint(newPlatform, platformNames)}
              />
            )}
          </div>
          {creating && (
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor={ids.name}>New asset name</label>
                <input id={ids.name} className="input" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <Combobox
                label="Asset class"
                value={newClass}
                onChange={setNewClass}
                options={availableAssetClasses}
                hint={classHint(newClass, availableAssetClasses)}
              />
            </div>
          )}
        </fieldset>

        <div className="form-grid-2">
          <MoneyInput label="Amount (USD)" value={amount} onChange={setAmount} />
          <MoneyInput label="Fee (USD, optional)" value={fee} onChange={setFee} />
        </div>

        <div className="form-grid-2">
          <DateInput value={date} onChange={setDate} />
          <div className="field">
            <label htmlFor={ids.note}>Note (optional)</label>
            <input
              id={ids.note}
              className="input"
              type="text"
              placeholder="e.g. Moving savings"
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {(preview || overdrawn || feeTooBig) && (
          <div className={preview ? 'preview' : 'preview preview-error'} aria-live="polite">
            {preview ? (
              <>
                <div>{preview.from}</div>
                <div>{preview.to}</div>
              </>
            ) : overdrawn ? (
              `You can transfer up to ${formatUsd(source!.valueUsd)} from ${source!.name}.`
            ) : (
              "The fee can't be larger than the amount."
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || overdrawn || feeTooBig}>
            {saving ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
