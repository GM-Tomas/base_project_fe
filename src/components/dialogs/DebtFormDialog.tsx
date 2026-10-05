'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { FormError } from '@/components/ui/FormError';
import { DateInput } from '@/components/ui/DateInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { errorMessage } from '@/lib/apiError';
import type { DebtInput, DebtPatch } from '@/lib/api';
import { debtPayoff } from '@/lib/amortization';
import { DEBT_KIND_LABEL, DEBT_KINDS, payoffDetail, payoffText } from '@/lib/debts';
import { normalizeLabel } from '@/lib/labels';
import { formatUsd, parseAmount } from '@/lib/money';
import { dateProblem, occurredAtFor, today } from '@/lib/movements';
import type { BalanceChangeReason, Debt, DebtKind } from '@/types/wealth';

export const MAX_DEBT_NOTES = 500;
const MAX_NAME = 120;
const MAX_RATE = 200;

type Reason = { value: BalanceChangeReason; label: string };
const PAYMENT: Reason = { value: 'PAYMENT', label: 'Payment' };
const CHARGE: Reason = { value: 'CHARGE', label: 'New charges' };
const INTEREST: Reason = { value: 'INTEREST', label: 'Interest' };
const CORRECTION: Reason = { value: 'CORRECTION', label: 'Correction' };

/** The reasons that fit a new balance: a payment lowers it, charges and interest raise it. */
export const reasonsFor = (previous: number, next: number): Reason[] =>
  next < previous ? [PAYMENT, CORRECTION] : [CHARGE, INTEREST, CORRECTION];

/** What a new balance will be recorded as, for this reason. */
export function balanceReasonHint(reason: BalanceChangeReason, previous: number, next: number): string {
  const by = formatUsd(Math.abs(next - previous));
  if (reason === 'PAYMENT') return `Recorded as a payment of ${by}.`;
  if (reason === 'CHARGE') return `Recorded as new charges of ${by}.`;
  if (reason === 'INTEREST') return `Recorded as interest of ${by}.`;
  return `Recorded as a correction of ${by}: the balance was off, nothing was paid or charged.`;
}

// An optional number field: what it holds, nothing when it's empty, or what's wrong with it.
type Parsed = { value: number | null; error?: string };

function parseOptionalAmount(text: string): Parsed {
  if (!text.trim()) return { value: null };
  const parsed = parseAmount(text);
  return parsed.error !== undefined ? { value: null, error: parsed.error } : { value: parsed.value };
}

export function parseRate(text: string): Parsed {
  const parsed = parseOptionalAmount(text.replace('%', ''));
  if (parsed.error) return { value: null, error: 'Enter the rate as a number, like 12.5' };
  if (parsed.value !== null && parsed.value > MAX_RATE) return { value: null, error: `The rate can't be over ${MAX_RATE}%` };
  return parsed;
}

export function parseDueDay(text: string): Parsed {
  if (!text.trim()) return { value: null };
  const day = Number(text.trim());
  return Number.isInteger(day) && day >= 1 && day <= 31 ? { value: day } : { value: null, error: 'Pick a day between 1 and 31' };
}

const sameText = (typed: string, stored: string | null) => (typed.trim() || null) === (stored ?? null);

export interface DebtFormDialogProps {
  onClose: () => void;
  /** The debt to edit; without it, the dialog adds one. */
  debt?: Debt;
}

// Adding a debt, or editing one: what it is, what's left to pay, and its terms. While the terms are typed
// it says when it'd be paid off; a new balance asks what it was (a payment, charges, interest or a
// correction) and when.
export function DebtFormDialog({ onClose, debt }: DebtFormDialogProps) {
  const { addDebt, updateDebt } = useWealth();
  const { toast } = useUi();
  const ids = { name: useId(), lender: useId(), kind: useId(), rate: useId(), dueDay: useId(), notes: useId() };

  const [name, setName] = useState(debt?.name ?? '');
  const [lender, setLender] = useState(debt?.lender ?? '');
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'OTHER');
  const [balance, setBalance] = useState(debt ? String(debt.balanceUsd) : '');
  const [rate, setRate] = useState(debt?.interestRatePct != null ? String(debt.interestRatePct) : '');
  const [payment, setPayment] = useState(debt?.monthlyPaymentUsd != null ? String(debt.monthlyPaymentUsd) : '');
  const [dueDay, setDueDay] = useState(debt?.dueDay != null ? String(debt.dueDay) : '');
  const [notes, setNotes] = useState(debt?.notes ?? '');
  const [reason, setReason] = useState<BalanceChangeReason>('CORRECTION');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedBalance = balance.trim() ? parseAmount(balance) : null;
  const parsedRate = parseRate(rate);
  const parsedPayment = parseOptionalAmount(payment);
  const parsedDueDay = parseDueDay(dueDay);
  const balanceValue = parsedBalance?.value;
  const balanceChanged = !!debt && balanceValue !== undefined && balanceValue !== debt.balanceUsd;
  const reasons = balanceChanged ? reasonsFor(debt.balanceUsd, balanceValue) : [];
  // A reason that no longer fits the new balance (it went the other way) falls back to a correction.
  const chosenReason = reasons.some((r) => r.value === reason) ? reason : 'CORRECTION';

  // When it'd be paid off with what's typed, as the API works it out.
  const payoff =
    balanceValue !== undefined && !parsedRate.error && !parsedPayment.error
      ? debtPayoff({ balanceUsd: balanceValue, interestRatePct: parsedRate.value, monthlyPaymentUsd: parsedPayment.value }, new Date())
      : null;

  const patch = debt && changes(debt);
  // Editing, Save waits for something to change (a balance it can't read counts: Save says what's wrong).
  const unchanged = !!patch && Object.keys(patch).length === 0 && !!parsedBalance && parsedBalance.error === undefined;

  // What the edit changes, as a merge patch: only what differs, null to clear a term.
  function changes(d: Debt): DebtPatch {
    const p: DebtPatch = {};
    if (normalizeLabel(name) !== d.name) p.name = name.trim();
    if (!sameText(normalizeLabel(lender), d.lender)) p.lender = normalizeLabel(lender) || null;
    if (kind !== d.kind) p.kind = kind;
    if (balanceChanged) {
      p.balanceUsd = balanceValue;
      if (chosenReason !== 'CORRECTION') p.balanceChangeReason = chosenReason;
      const occurredAt = occurredAtFor(date);
      if (occurredAt) p.occurredAt = occurredAt;
    }
    if (!parsedRate.error && parsedRate.value !== d.interestRatePct) p.interestRatePct = parsedRate.value;
    if (!parsedPayment.error && parsedPayment.value !== d.monthlyPaymentUsd) p.monthlyPaymentUsd = parsedPayment.value;
    if (!parsedDueDay.error && parsedDueDay.value !== d.dueDay) p.dueDay = parsedDueDay.value;
    if (!sameText(notes, d.notes)) p.notes = notes.trim() || null;
    return p;
  }

  const problem = () =>
    !normalizeLabel(name)
      ? 'Please enter a name'
      : [...normalizeLabel(name)].length > MAX_NAME
        ? `Keep the name under ${MAX_NAME} characters`
        : [...normalizeLabel(lender)].length > MAX_NAME
          ? `Keep the lender under ${MAX_NAME} characters`
          : !balance.trim()
            ? "Please enter what's left to pay"
            : (parsedBalance!.error ??
              (parsedRate.error ? `Interest rate: ${parsedRate.error}` : undefined) ??
              (parsedPayment.error ? `Monthly payment: ${parsedPayment.error}` : undefined) ??
              (parsedDueDay.error ? `Due day: ${parsedDueDay.error}` : undefined) ??
              ([...notes.trim()].length > MAX_DEBT_NOTES ? `Keep the notes under ${MAX_DEBT_NOTES} characters` : undefined) ??
              (balanceChanged ? dateProblem(date) : undefined));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wrong = problem();
    if (wrong) {
      setError(wrong);
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (debt) {
        await updateDebt(debt.id, patch!);
      } else {
        const input: DebtInput = { name: name.trim(), kind, balanceUsd: balanceValue! };
        if (normalizeLabel(lender)) input.lender = lender.trim();
        if (parsedRate.value !== null) input.interestRatePct = parsedRate.value;
        if (parsedPayment.value !== null) input.monthlyPaymentUsd = parsedPayment.value;
        if (parsedDueDay.value !== null) input.dueDay = parsedDueDay.value;
        if (notes.trim()) input.notes = notes.trim();
        await addDebt(input);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save this debt. Please try again.'));
      setSaving(false);
      return;
    }
    toast.success(debt ? 'Changes saved' : 'Debt added');
    onClose();
  };

  const outlook = payoff && payoffText(payoff);
  const detail = payoff && payoffDetail(payoff);

  return (
    <Modal title={debt ? 'Edit debt' : 'Add a debt'} onClose={onClose} busy={saving} className="dialog-wide">
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <div className="form-grid-2">
          <div className="field">
            <label htmlFor={ids.name}>Name</label>
            <input
              id={ids.name}
              className="input"
              type="text"
              placeholder="e.g. Visa Gold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={ids.lender}>Lender (optional)</label>
            <input
              id={ids.lender}
              className="input"
              type="text"
              placeholder="e.g. Santander"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor={ids.kind}>Kind</label>
            <select id={ids.kind} className="input" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
              {DEBT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DEBT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <MoneyInput label="Left to pay (USD)" value={balance} onChange={setBalance} />
        </div>

        {balanceChanged && (
          <div className="form-reason">
            <SegmentedControl
              label="What changed the balance?"
              showLabel
              options={reasons}
              value={chosenReason}
              onChange={setReason}
              hint={balanceReasonHint(chosenReason, debt.balanceUsd, balanceValue)}
            />
            <div className="form-grid-2">
              <DateInput label="When" value={date} onChange={setDate} />
            </div>
          </div>
        )}

        <div className="form-grid-3">
          <div className="field">
            <label htmlFor={ids.rate}>Interest (% a year, optional)</label>
            <input
              id={ids.rate}
              className="input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 12.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              aria-invalid={parsedRate.error ? true : undefined}
            />
            {parsedRate.error && <div className="field-error">{parsedRate.error}</div>}
          </div>
          <MoneyInput label="Monthly payment (optional)" value={payment} onChange={setPayment} />
          <div className="field">
            <label htmlFor={ids.dueDay}>Due day (optional)</label>
            <input
              id={ids.dueDay}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step={1}
              placeholder="1–31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              aria-invalid={parsedDueDay.error ? true : undefined}
            />
            {parsedDueDay.error && <div className="field-error">{parsedDueDay.error}</div>}
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.notes}>Notes (optional)</label>
          <textarea
            id={ids.notes}
            className="input"
            rows={2}
            maxLength={MAX_DEBT_NOTES}
            placeholder="e.g. Fixed rate, 36 payments"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {outlook && (
          <div className={outlook.tone === 'negative' ? 'preview preview-error' : 'preview'} aria-live="polite">
            <div>{outlook.text}</div>
            {detail && <div className="text-muted">{detail}</div>}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || unchanged}>
            {saving ? 'Saving…' : debt ? 'Save changes' : 'Save debt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
