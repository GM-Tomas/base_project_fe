'use client';

import React, { useId, useRef, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DateInput } from '@/components/ui/DateInput';
import { FormError } from '@/components/ui/FormError';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { errorMessage } from '@/lib/apiError';
import type { MovementInput } from '@/lib/api';
import { formatUsd, parseAmount } from '@/lib/money';
import { dateProblem, occurredAtFor, today, type DebtMovementKind } from '@/lib/movements';
import type { Debt, Holding } from '@/types/wealth';
import { MAX_NOTE, noteFor, noteProblem } from './RecordChangeDialog';
import { useMovementFeedback } from './useMovementFeedback';

const KINDS: { value: DebtMovementKind; label: string; hint: string; title: string; action: string }[] = [
  { value: 'DEBT_PAYMENT', label: 'Pay', hint: 'A payment: what you paid toward it.', title: 'Record a payment', action: 'Record payment' },
  {
    value: 'DEBT_CHARGE',
    label: 'New charge',
    hint: 'A new charge: purchases with the card, or more money borrowed.',
    title: 'Record a new charge',
    action: 'Record charge',
  },
  {
    value: 'DEBT_INTEREST',
    label: 'Interest',
    hint: 'Interest or fees the lender added.',
    title: 'Record interest',
    action: 'Record interest',
  },
];

const cents = (n: number) => Math.round(n * 100) / 100;

/** What a payment starts at: the monthly payment, or what's left to pay if that's less. */
export const suggestedPayment = (d: Debt) =>
  d.monthlyPaymentUsd && d.balanceUsd > 0 ? Math.min(d.monthlyPaymentUsd, d.balanceUsd) : null;

export interface DebtPaymentDialogProps {
  debt: Debt;
  kind?: DebtMovementKind;
  onClose: () => void;
}

// A payment toward a debt (from one of the user's assets, maybe), a new charge on it (money that went into
// an asset, maybe) or interest: how much, when, and what it does to what's owed and to the asset.
export function DebtPaymentDialog({ debt: opened, kind: initialKind = 'DEBT_PAYMENT', onClose }: DebtPaymentDialogProps) {
  const { debts, holdings, recordMovement } = useWealth();
  const { recorded } = useMovementFeedback();
  const ids = { holding: useId(), note: useId() };
  const amountRef = useRef<HTMLInputElement>(null);
  // As it is now: a refresh while the dialog is open may have changed its balance.
  const debt = debts.find((d) => d.id === opened.id) ?? opened;
  const suggested = suggestedPayment(debt);

  const [kind, setKind] = useState<DebtMovementKind>(initialKind);
  // A payment starts at the monthly payment.
  const [amount, setAmount] = useState(initialKind === 'DEBT_PAYMENT' && suggested ? formatUsd(suggested) : '');
  const [holdingId, setHoldingId] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const option = KINDS.find((k) => k.value === kind)!;
  const paying = kind === 'DEBT_PAYMENT';
  const holding = kind === 'DEBT_INTEREST' ? undefined : holdings.find((h) => h.id === holdingId);
  const parsed = amount.trim() ? parseAmount(amount) : null;
  const value = parsed?.value;
  const debtAfter = value ? cents(debt.balanceUsd + (paying ? -value : value)) : null;
  const holdingAfter = value && holding ? cents(holding.valueUsd + (paying ? -value : value)) : null;
  const overpaid = debtAfter !== null && debtAfter < 0;
  const overdrawn = holdingAfter !== null && holdingAfter < 0;

  // An amount nobody typed (empty, or the monthly payment it started at) follows the kind picked.
  const pickKind = (next: DebtMovementKind) => {
    const untouched = amount === '' || (suggested !== null && amount === formatUsd(suggested));
    if (untouched) setAmount(next === 'DEBT_PAYMENT' && suggested ? formatUsd(suggested) : '');
    // Where a payment came from isn't where a charge went.
    if ((next === 'DEBT_PAYMENT') !== (kind === 'DEBT_PAYMENT')) setHoldingId('');
    setKind(next);
  };

  // The holdings by platform, each listed with what it's worth.
  const byPlatform = new Map<string, Holding[]>();
  for (const h of [...holdings].sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name))) {
    byPlatform.set(h.platform, [...(byPlatform.get(h.platform) ?? []), h]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !amount.trim()
      ? 'Please enter an amount'
      : (parsed!.error ??
        (value === 0 ? 'The amount must be more than 0' : undefined) ??
        (overpaid ? `That's more than what's left to pay (${formatUsd(debt.balanceUsd)})` : undefined) ??
        (overdrawn ? `That's more than ${holding!.name} is worth (${formatUsd(holding!.valueUsd)})` : undefined) ??
        dateProblem(date) ??
        noteProblem(note));
    if (problem) {
      setError(problem);
      return;
    }
    const common = { debtId: debt.id, amountUsd: value!, occurredAt: occurredAtFor(date), note: noteFor(note) };
    const input: MovementInput =
      kind === 'DEBT_PAYMENT'
        ? { kind, ...common, ...(holding && { fromHoldingId: holding.id }) }
        : kind === 'DEBT_CHARGE'
          ? { kind, ...common, ...(holding && { toHoldingId: holding.id }) }
          : { kind, ...common };
    setError('');
    setSaving(true);
    let movement;
    try {
      movement = await recordMovement(input);
    } catch (err) {
      setError(errorMessage(err, "Couldn't record this. Please try again."));
      setSaving(false);
      return;
    }
    recorded(movement);
    onClose();
  };

  return (
    <Modal title={option.title} onClose={onClose} busy={saving} initialFocusRef={amountRef}>
      <div className="dialog-subtitle">
        {[debt.name, debt.lender, `${formatUsd(debt.balanceUsd)} left to pay`].filter(Boolean).join(' · ')}
      </div>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <SegmentedControl label="What happened?" options={KINDS} value={kind} onChange={pickKind} hint={option.hint} />

        <div>
          <MoneyInput label="Amount (USD)" value={amount} onChange={setAmount} inputRef={amountRef} />
          {paying && debt.balanceUsd > 0 && (
            <div className="field-hint quick-amounts">
              {suggested !== null && suggested < debt.balanceUsd && (
                <button type="button" className="link-btn link-accent" onClick={() => setAmount(formatUsd(suggested))}>
                  Monthly payment
                </button>
              )}
              <button type="button" className="link-btn link-accent" onClick={() => setAmount(formatUsd(debt.balanceUsd))}>
                Full balance
              </button>
            </div>
          )}
        </div>

        {kind !== 'DEBT_INTEREST' && holdings.length > 0 && (
          <div className="field">
            <label htmlFor={ids.holding}>{paying ? 'Paid from (optional)' : 'Money went to (optional)'}</label>
            <select id={ids.holding} className="input" value={holding?.id ?? ''} onChange={(e) => setHoldingId(e.target.value)}>
              <option value="">{paying ? 'Not from an asset I track' : 'Not into an asset I track'}</option>
              {[...byPlatform].map(([platform, list]) => (
                <optgroup key={platform} label={platform}>
                  {list.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · {formatUsd(h.valueUsd)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="field-hint">
              {paying ? 'Its value goes down by the same amount.' : 'A loan paid into an account, say: its value goes up by the same amount.'}
            </div>
          </div>
        )}

        <div className="form-grid-2">
          <DateInput value={date} onChange={setDate} />
          <div className="field">
            <label htmlFor={ids.note}>Note (optional)</label>
            <input
              id={ids.note}
              className="input"
              type="text"
              placeholder={paying ? 'e.g. October installment' : 'e.g. Groceries'}
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {debtAfter !== null && (
          <div className={overpaid || overdrawn ? 'preview preview-error' : 'preview'} aria-live="polite">
            {overpaid ? (
              `That's more than what's left to pay on ${debt.name} (${formatUsd(debt.balanceUsd)}).`
            ) : overdrawn ? (
              `That's more than ${holding!.name} is worth (${formatUsd(holding!.valueUsd)}).`
            ) : (
              <>
                <div>
                  {debt.name}: {formatUsd(debt.balanceUsd)} → {formatUsd(debtAfter)} left to pay
                  {debtAfter === 0 && ' · paid off'}
                </div>
                {holding && (
                  <div>
                    {holding.name}: {formatUsd(holding.valueUsd)} → {formatUsd(holdingAfter!)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || overpaid || overdrawn}>
            {saving ? 'Recording…' : option.action}
          </button>
        </div>
      </form>
    </Modal>
  );
}
