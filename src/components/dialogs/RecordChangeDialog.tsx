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
import { dateProblem, kindLabel, occurredAtFor, today, type RecordableKind } from '@/lib/movements';
import { messages, useT } from '@/lib/i18n';
import type { Holding } from '@/types/wealth';
import { useMovementFeedback } from './useMovementFeedback';

export const MAX_NOTE = 200;

const KINDS: RecordableKind[] = ['GAIN', 'LOSS', 'DEPOSIT', 'WITHDRAWAL'];

const cents = (n: number) => Math.round(n * 100) / 100;

/** The note a dialog sends: trimmed, nothing when empty. */
export const noteFor = (text: string) => text.trim() || undefined;
export const noteProblem = (text: string) =>
  [...text.trim()].length > MAX_NOTE ? messages().dates.noteTooLong(MAX_NOTE) : undefined;

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
  const tAll = useT();
  const t = tAll.recordChange;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !amount.trim()
      ? tAll.amounts.enter
      : (parsed!.error ?? (value === 0 ? tAll.amounts.moreThanZero : undefined) ?? dateProblem(date) ?? noteProblem(note));
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
      setError(errorMessage(err, t.failed));
      setSaving(false);
      return;
    }
    recorded(movement);
    onClose();
  };

  return (
    <Modal title={t.title} onClose={onClose} busy={saving} initialFocusRef={amountRef}>
      <div className="dialog-subtitle">{t.worth(holding.name, holding.platform, formatUsd(holding.valueUsd))}</div>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <SegmentedControl
          label={t.whatHappened}
          options={KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
          value={kind}
          onChange={setKind}
          hint={t.hints[kind]}
        />

        <MoneyInput label={tAll.common.amountUsd} value={amount} onChange={setAmount} inputRef={amountRef} />

        <div className="form-grid-2">
          <DateInput value={date} onChange={setDate} />
          <div className="field">
            <label htmlFor={noteId}>{tAll.common.noteOptional}</label>
            <input
              id={noteId}
              className="input"
              type="text"
              placeholder={t.notePlaceholder}
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {after !== null && (
          <div className={tooMuch ? 'preview preview-error' : 'preview'} aria-live="polite">
            {tooMuch
              ? t.moreThanWorth(holding.name, formatUsd(holding.valueUsd))
              : t.preview(holding.name, formatUsd(holding.valueUsd), formatUsd(after))}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || tooMuch}>
            {saving ? tAll.common.recording : t.actions[kind]}
          </button>
        </div>
      </form>
    </Modal>
  );
}
