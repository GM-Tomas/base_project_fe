'use client';

import React, { useId, useRef, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DateInput } from '@/components/ui/DateInput';
import { FormError } from '@/components/ui/FormError';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { errorMessage } from '@/lib/apiError';
import { formatUsd, parseAmount } from '@/lib/money';
import { dateProblem, KIND_LABEL, occurredAtFor, today, type RecordableKind } from '@/lib/movements';
import type { Holding } from '@/types/wealth';
import { useMovementFeedback } from './useMovementFeedback';

export const MAX_NOTE = 200;

const KINDS: { value: RecordableKind; label: string; hint: string }[] = [
  { value: 'GAIN', label: 'Gain', hint: 'Gain: interest, dividends or a rise in price.' },
  { value: 'LOSS', label: 'Loss', hint: 'Loss: a fall in price, or a cost.' },
  { value: 'DEPOSIT', label: 'Deposit', hint: 'Deposit: new money you put in.' },
  { value: 'WITHDRAWAL', label: 'Withdrawal', hint: 'Withdrawal: money you took out.' },
];

const cents = (n: number) => Math.round(n * 100) / 100;

/** The note a dialog sends: trimmed, nothing when empty. */
export const noteFor = (text: string) => text.trim() || undefined;
export const noteProblem = (text: string) =>
  [...text.trim()].length > MAX_NOTE ? `Keep the note under ${MAX_NOTE} characters` : undefined;

export interface RecordChangeDialogProps {
  holding: Holding;
  kind?: RecordableKind;
  onClose: () => void;
}

// A gain, loss, deposit or withdrawal on one holding: how much, when, and why, with what the holding will be
// worth after it.
export function RecordChangeDialog({ holding: opened, kind: initialKind = 'GAIN', onClose }: RecordChangeDialogProps) {
  const { holdings, recordMovement } = useWealth();
  const { recorded } = useMovementFeedback();
  const noteId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  // As it is now: a refresh while the dialog is open may have changed its value.
  const holding = holdings.find((h) => h.id === opened.id) ?? opened;

  const [kind, setKind] = useState<RecordableKind>(initialKind);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = amount.trim() ? parseAmount(amount) : null;
  const value = parsed?.value;
  const down = kind === 'LOSS' || kind === 'WITHDRAWAL';
  const after = value ? cents(holding.valueUsd + (down ? -value : value)) : null;
  const tooMuch = after !== null && after < 0;
  const label = KIND_LABEL[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !amount.trim()
      ? 'Please enter an amount'
      : (parsed!.error ?? (value === 0 ? 'The amount must be more than 0' : undefined) ?? dateProblem(date) ?? noteProblem(note));
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    let movement;
    try {
      movement = await recordMovement({
        kind,
        holdingId: holding.id,
        amountUsd: value!,
        occurredAt: occurredAtFor(date),
        note: noteFor(note),
      });
    } catch (err) {
      setError(errorMessage(err, "Couldn't record this change. Please try again."));
      setSaving(false);
      return;
    }
    recorded(movement);
    onClose();
  };

  return (
    <Modal title="Record a change" onClose={onClose} busy={saving} initialFocusRef={amountRef}>
      <div className="dialog-subtitle">
        {holding.name} · {holding.platform} · worth {formatUsd(holding.valueUsd)}
      </div>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <SegmentedControl
          label="What happened?"
          options={KINDS}
          value={kind}
          onChange={setKind}
          hint={KINDS.find((k) => k.value === kind)!.hint}
        />

        <MoneyInput label="Amount (USD)" value={amount} onChange={setAmount} inputRef={amountRef} />

        <div className="form-grid-2">
          <DateInput value={date} onChange={setDate} />
          <div className="field">
            <label htmlFor={noteId}>Note (optional)</label>
            <input
              id={noteId}
              className="input"
              type="text"
              placeholder="e.g. Dividends"
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {after !== null && (
          <div className={tooMuch ? 'preview preview-error' : 'preview'} aria-live="polite">
            {tooMuch
              ? `That's more than ${holding.name} is worth (${formatUsd(holding.valueUsd)}).`
              : `${holding.name}: ${formatUsd(holding.valueUsd)} → ${formatUsd(after)}`}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || tooMuch}>
            {saving ? 'Recording…' : `Record ${label.toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
