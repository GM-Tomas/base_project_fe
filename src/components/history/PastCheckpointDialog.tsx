'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DateInput } from '@/components/ui/DateInput';
import { errorMessage } from '@/lib/apiError';
import type { PastCheckpointInput } from '@/lib/api';
import { formatUsd, parseAmount, parseSignedAmount } from '@/lib/money';
import { dateProblem, formatDay } from '@/lib/movements';
import { localDay } from '@/lib/periods';
import { round2 } from '@/lib/returns';

const MAX_NOTE = 200;

/** When a checkpoint for a picked day is taken: that day's noon here, or now if it's today and still morning. */
export function checkpointInstant(date: string, now: Date = new Date()): string {
  const noon = localDay(date)!;
  noon.setHours(12);
  return (noon > now ? now : noon).toISOString();
}

// A checkpoint from before BASE: the day, the net worth, and, if known, what was owned and owed (then the net
// worth is worked out from them). It goes into History like any other, marked as added by hand.
export function PastCheckpointDialog({ onClose }: { onClose: () => void }) {
  const { takeSnapshot } = useWealth();
  const { toast } = useUi();
  const noteId = useId();
  const [date, setDate] = useState('');
  const [net, setNet] = useState('');
  const [split, setSplit] = useState(false);
  const [assets, setAssets] = useState('');
  const [debts, setDebts] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAssets = assets.trim() ? parseAmount(assets) : null;
  const parsedDebts = debts.trim() ? parseAmount(debts) : null;
  const worked =
    split && parsedAssets?.value !== undefined && parsedDebts?.value !== undefined ? round2(parsedAssets.value - parsedDebts.value) : null;
  const parsedNet = split ? null : net.trim() ? parseSignedAmount(net) : null;

  const problem = () =>
    !date
      ? 'Please pick the date'
      : (dateProblem(date) ??
        (split
          ? !parsedAssets || !parsedDebts
            ? 'Please enter what you owned and what you owed'
            : (parsedAssets.error ?? parsedDebts.error)
          : !parsedNet
            ? 'Please enter your net worth then'
            : parsedNet.error) ??
        ([...note.trim()].length > MAX_NOTE ? `Keep the note under ${MAX_NOTE} characters` : undefined));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const wrong = problem();
    if (wrong) {
      setError(wrong);
      return;
    }
    const input: PastCheckpointInput = split
      ? { capturedAt: checkpointInstant(date), totalValueUsd: worked!, assetsUsd: parsedAssets!.value!, debtsUsd: parsedDebts!.value! }
      : { capturedAt: checkpointInstant(date), totalValueUsd: parsedNet!.value! };
    if (note.trim()) input.note = note.trim();
    setError('');
    setSaving(true);
    try {
      await takeSnapshot(input);
    } catch (err) {
      setError(errorMessage(err, 'Could not save this checkpoint. Please try again.'));
      setSaving(false);
      return;
    }
    toast.success(`Checkpoint of ${formatDay(input.capturedAt)} added`);
    onClose();
  };

  return (
    <Modal title="Add a past checkpoint" onClose={onClose} busy={saving}>
      <div className="dialog-text">Your net worth on a day before you started with BASE, so your history begins earlier.</div>
      {error && <FormError>{error}</FormError>}
      <form onSubmit={save} noValidate className="dialog-form">
        <DateInput label="Date" value={date} onChange={setDate} />
        <label className="check" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />I know what I owned and owed
        </label>
        {split ? (
          <>
            <div className="form-grid-2">
              <MoneyInput label="What you owned (USD)" value={assets} onChange={setAssets} />
              <MoneyInput label="What you owed (USD)" value={debts} onChange={setDebts} />
            </div>
            <div className="preview" aria-live="polite">
              Net worth: {worked === null ? '—' : formatUsd(worked)}
            </div>
          </>
        ) : (
          <MoneyInput label="Net worth then (USD)" value={net} onChange={setNet} signed placeholder="e.g. 81,000 or -2,500" />
        )}
        <div className="field">
          <label htmlFor={noteId}>Note (optional)</label>
          <input
            id={noteId}
            className="input"
            type="text"
            maxLength={MAX_NOTE}
            placeholder="e.g. From my spreadsheet"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add checkpoint'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
