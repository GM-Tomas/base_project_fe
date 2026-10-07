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
import { DEBT_KINDS, debtKindLabel, payoffDetail, payoffText } from '@/lib/debts';
import { messages, useT } from '@/lib/i18n';
import { normalizeLabel } from '@/lib/labels';
import { formatUsd, parseAmount } from '@/lib/money';
import { dateProblem, occurredAtFor, today } from '@/lib/movements';
import type { BalanceChangeReason, Debt, DebtKind } from '@/types/wealth';

export const MAX_DEBT_NOTES = 500;
const MAX_NAME = 120;
const MAX_RATE = 200;

type Reason = { value: BalanceChangeReason; label: string };
const reason = (value: BalanceChangeReason): Reason => ({ value, label: messages().debtForm.reasons[value] });

/** The reasons that fit a new balance: a payment lowers it, charges and interest raise it. */
export const reasonsFor = (previous: number, next: number): Reason[] =>
  (next < previous ? (['PAYMENT', 'CORRECTION'] as const) : (['CHARGE', 'INTEREST', 'CORRECTION'] as const)).map(reason);

/** What a new balance will be recorded as, for this reason. */
export function balanceReasonHint(reason: BalanceChangeReason, previous: number, next: number): string {
  const t = messages().debtForm;
  const by = formatUsd(Math.abs(next - previous));
  if (reason === 'PAYMENT') return t.asPayment(by);
  if (reason === 'CHARGE') return t.asCharges(by);
  if (reason === 'INTEREST') return t.asInterest(by);
  return t.asCorrection(by);
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
  if (parsed.error) return { value: null, error: messages().debtForm.rateHint };
  if (parsed.value !== null && parsed.value > MAX_RATE) return { value: null, error: messages().debtForm.rateMax(MAX_RATE) };
  return parsed;
}

export function parseDueDay(text: string): Parsed {
  if (!text.trim()) return { value: null };
  const day = Number(text.trim());
  return Number.isInteger(day) && day >= 1 && day <= 31 ? { value: day } : { value: null, error: messages().debtForm.dueDayHint };
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
  const tAll = useT();
  const t = tAll.debtForm;
  const ids = { name: useId(), lender: useId(), kind: useId(), rate: useId(), dueDay: useId(), notes: useId() };

  const [name, setName] = useState(debt?.name ?? '');
  const [lender, setLender] = useState(debt?.lender ?? '');
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'OTHER');
  const [balance, setBalance] = useState(debt ? String(debt.balanceUsd) : '');
  const [rate, setRate] = useState(debt?.interestRatePct != null ? String(debt.interestRatePct) : '');
  const [payment, setPayment] = useState(debt?.monthlyPaymentUsd != null ? String(debt.monthlyPaymentUsd) : '');
  const [dueDay, setDueDay] = useState(debt?.dueDay != null ? String(debt.dueDay) : '');
  const [notes, setNotes] = useState(debt?.notes ?? '');
  const [chosen, setReason] = useState<BalanceChangeReason>('CORRECTION');
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
  const chosenReason = reasons.some((r) => r.value === chosen) ? chosen : 'CORRECTION';

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
      ? t.enterName
      : [...normalizeLabel(name)].length > MAX_NAME
        ? t.nameTooLong(MAX_NAME)
        : [...normalizeLabel(lender)].length > MAX_NAME
          ? t.lenderTooLong(MAX_NAME)
          : !balance.trim()
            ? t.enterBalance
            : (parsedBalance!.error ??
              (parsedRate.error ? t.rateProblem(parsedRate.error) : undefined) ??
              (parsedPayment.error ? t.paymentProblem(parsedPayment.error) : undefined) ??
              (parsedDueDay.error ? t.dueDayProblem(parsedDueDay.error) : undefined) ??
              ([...notes.trim()].length > MAX_DEBT_NOTES ? t.notesTooLong(MAX_DEBT_NOTES) : undefined) ??
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
      setError(errorMessage(err, t.saveFailed));
      setSaving(false);
      return;
    }
    toast.success(debt ? tAll.common.changesSaved : t.added);
    onClose();
  };

  const outlook = payoff && payoffText(payoff);
  const detail = payoff && payoffDetail(payoff);

  return (
    <Modal title={debt ? t.titleEdit : t.titleAdd} onClose={onClose} busy={saving} className="dialog-wide">
      {error && <FormError>{error}</FormError>}

      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        <div className="form-grid-2">
          <div className="field">
            <label htmlFor={ids.name}>{tAll.common.name}</label>
            <input
              id={ids.name}
              className="input"
              type="text"
              placeholder={t.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={ids.lender}>{t.lender}</label>
            <input
              id={ids.lender}
              className="input"
              type="text"
              placeholder={t.lenderPlaceholder}
              value={lender}
              onChange={(e) => setLender(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor={ids.kind}>{t.kind}</label>
            <select id={ids.kind} className="input" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
              {DEBT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {debtKindLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <MoneyInput label={t.leftToPay} value={balance} onChange={setBalance} />
        </div>

        {balanceChanged && (
          <div className="form-reason">
            <SegmentedControl
              label={t.whatChanged}
              showLabel
              options={reasons}
              value={chosenReason}
              onChange={setReason}
              hint={balanceReasonHint(chosenReason, debt.balanceUsd, balanceValue)}
            />
            <div className="form-grid-2">
              <DateInput label={tAll.common.when} value={date} onChange={setDate} />
            </div>
          </div>
        )}

        <div className="form-grid-3">
          <div className="field">
            <label htmlFor={ids.rate}>{t.rate}</label>
            <input
              id={ids.rate}
              className="input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t.ratePlaceholder}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              aria-invalid={parsedRate.error ? true : undefined}
            />
            {parsedRate.error && <div className="field-error">{parsedRate.error}</div>}
          </div>
          <MoneyInput label={t.payment} value={payment} onChange={setPayment} />
          <div className="field">
            <label htmlFor={ids.dueDay}>{t.dueDay}</label>
            <input
              id={ids.dueDay}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step={1}
              placeholder={t.dueDayPlaceholder}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              aria-invalid={parsedDueDay.error ? true : undefined}
            />
            {parsedDueDay.error && <div className="field-error">{parsedDueDay.error}</div>}
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.notes}>{t.notes}</label>
          <textarea
            id={ids.notes}
            className="input"
            rows={2}
            maxLength={MAX_DEBT_NOTES}
            placeholder={t.notesPlaceholder}
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
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || unchanged}>
            {saving ? tAll.common.saving : debt ? tAll.common.saveChanges : t.saveDebt}
          </button>
        </div>
      </form>
    </Modal>
  );
}
