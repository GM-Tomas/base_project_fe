import type { Debt, DebtKind } from '@/types/wealth';
import type { DebtInput, DebtPatch } from './api';
import { ApiError } from './apiError';
import { debtPayoff } from './amortization';
import { normalizeLabel as label } from './labels';
import { BAD_WHEN, balanceChangeKind, parseWhen, type MockDebt, type MockLedger } from './mockLedger';

// The API's debts (base_project_go: DebtHandler and DebtService), in memory: the same checks, messages,
// limit and order, each change of balance recorded in the activity log.

const MAX_DEBTS = 200;
const MAX_AMOUNT = 1e15;
const KINDS: DebtKind[] = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'PERSONAL', 'OTHER'];
const KIND_MESSAGE = 'kind must be one of CREDIT_CARD, LOAN, MORTGAGE, PERSONAL, OTHER';

type FieldError = { field: string; message: string };

const cents = (n: number) => Math.round(n * 100) / 100;
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);
const length = (text: string) => [...text].length;

// The handler's checks of each field, collected (null is what a PATCH sends to clear a term).
const checks = {
  balance(errors: FieldError[], v: number | null | undefined) {
    if (v === null || v === undefined || !Number.isFinite(v)) errors.push({ field: 'balanceUsd', message: 'Balance is required' });
    else if (v < 0) errors.push({ field: 'balanceUsd', message: 'Balance must not be negative' });
    else if (v > MAX_AMOUNT) errors.push({ field: 'balanceUsd', message: 'Balance is too large' });
  },
  rate(errors: FieldError[], v: number) {
    if (!(v >= 0 && v <= 200)) errors.push({ field: 'interestRatePct', message: 'interestRatePct must be between 0 and 200' });
  },
  payment(errors: FieldError[], v: number) {
    if (v < 0) errors.push({ field: 'monthlyPaymentUsd', message: 'Monthly payment must not be negative' });
    else if (v > MAX_AMOUNT) errors.push({ field: 'monthlyPaymentUsd', message: 'Monthly payment is too large' });
  },
  dueDay(errors: FieldError[], v: number) {
    // JSON's 1.5 isn't an int: the API can't even read the body.
    if (!Number.isInteger(v)) throw new ApiError(400, 'Malformed JSON body');
    if (v < 1 || v > 31) errors.push({ field: 'dueDay', message: 'dueDay must be between 1 and 31' });
  },
};

const reject = (errors: FieldError[]) => {
  if (errors.length) throw new ApiError(400, errors.map((e) => e.message).join('; '), errors);
};

// The domain's lengths, after the handler's checks: a name, a lender (optional) and notes.
function normalized(field: 'Debt name' | 'Lender', raw: string, max = 120) {
  const text = label(raw);
  if (length(text) > max) throw new ApiError(400, `${field} exceeds max length (${length(text)} > ${max})`);
  return text;
}

function notesOf(raw: string) {
  const text = raw.trim();
  if (length(text) > 500) throw new ApiError(400, `Notes exceeds max length (${length(text)} > 500)`);
  return text;
}

export function createMockDebts({ debts, ledger, now, nextId }: { debts: MockDebt[]; ledger: MockLedger; now: () => Date; nextId: () => string }) {
  const view = (d: MockDebt): Debt => ({ ...d, payoff: debtPayoff(d, now()) });
  const find = (id: string) => {
    const d = debts.find((x) => x.id === id);
    if (!d) throw new ApiError(404, `Debt ${id} not found`);
    return d;
  };

  return {
    getDebts: async (): Promise<Debt[]> =>
      [...debts].sort((a, b) => b.balanceUsd - a.balanceUsd || byName(a.name, b.name)).map(view),

    createDebt: async (input: DebtInput): Promise<Debt> => {
      const errors: FieldError[] = [];
      if (!label(input.name ?? '')) errors.push({ field: 'name', message: 'Name is required' });
      if (input.kind !== undefined && !KINDS.includes(input.kind)) errors.push({ field: 'kind', message: KIND_MESSAGE });
      checks.balance(errors, input.balanceUsd);
      if (input.interestRatePct != null) checks.rate(errors, input.interestRatePct);
      if (input.monthlyPaymentUsd != null) checks.payment(errors, input.monthlyPaymentUsd);
      if (input.dueDay != null) checks.dueDay(errors, input.dueDay);
      reject(errors);

      const name = normalized('Debt name', input.name);
      const lender = input.lender?.trim() ? normalized('Lender', input.lender) : '';
      const notes = notesOf(input.notes ?? '');
      if (debts.length >= MAX_DEBTS) throw new ApiError(409, `You can track up to ${MAX_DEBTS} debts. Remove one to add another.`);
      ledger.roomForOneMore();
      const at = now().toISOString();
      const debt: MockDebt = {
        id: nextId(),
        name,
        lender: lender || null,
        kind: input.kind ?? 'OTHER',
        balanceUsd: cents(input.balanceUsd),
        interestRatePct: input.interestRatePct != null ? cents(input.interestRatePct) : null,
        monthlyPaymentUsd: input.monthlyPaymentUsd != null ? cents(input.monthlyPaymentUsd) : null,
        dueDay: input.dueDay ?? null,
        notes: notes || null,
        createdAt: at,
        updatedAt: at,
      };
      debts.push(debt);
      ledger.debtOpened(debt);
      return view(debt);
    },

    // A merge patch: only what's sent changes (undefined isn't sent), null clears the optional terms.
    updateDebt: async (id: string, patch: DebtPatch): Promise<Debt> => {
      const errors: FieldError[] = [];
      if (patch.name !== undefined && !label(patch.name ?? '')) errors.push({ field: 'name', message: 'Name is required' });
      if (patch.kind !== undefined) {
        if ((patch.kind as DebtKind | null) === null) errors.push({ field: 'kind', message: 'Kind is required' });
        else if (!KINDS.includes(patch.kind)) errors.push({ field: 'kind', message: KIND_MESSAGE });
      }
      if (patch.balanceUsd !== undefined) checks.balance(errors, patch.balanceUsd);
      if (patch.interestRatePct != null) checks.rate(errors, patch.interestRatePct);
      if (patch.monthlyPaymentUsd != null) checks.payment(errors, patch.monthlyPaymentUsd);
      if (patch.dueDay != null) checks.dueDay(errors, patch.dueDay);
      if (patch.occurredAt && !parseWhen(patch.occurredAt, '12:00:00.000')) {
        errors.push({ field: 'occurredAt', message: BAD_WHEN('occurredAt') });
      }
      reject(errors);

      const changes: Partial<MockDebt> = {};
      if (patch.name !== undefined) changes.name = normalized('Debt name', patch.name);
      if (patch.lender !== undefined) changes.lender = patch.lender?.trim() ? normalized('Lender', patch.lender) : null;
      if (patch.kind !== undefined) changes.kind = patch.kind;
      if (patch.balanceUsd !== undefined) changes.balanceUsd = cents(patch.balanceUsd);
      if (patch.interestRatePct !== undefined) changes.interestRatePct = patch.interestRatePct === null ? null : cents(patch.interestRatePct);
      if (patch.monthlyPaymentUsd !== undefined) {
        changes.monthlyPaymentUsd = patch.monthlyPaymentUsd === null ? null : cents(patch.monthlyPaymentUsd);
      }
      if (patch.dueDay !== undefined) changes.dueDay = patch.dueDay;
      if (patch.notes !== undefined) changes.notes = notesOf(patch.notes ?? '') || null;
      const edit = ledger.checkDebtEdit(patch.balanceChangeReason, patch.occurredAt, patch.note);

      const debt = find(id);
      const updated = { ...debt, ...changes };
      const fields = ['name', 'lender', 'kind', 'balanceUsd', 'interestRatePct', 'monthlyPaymentUsd', 'dueDay', 'notes'] as const;
      if (fields.every((k) => updated[k] === debt[k])) return view(debt);
      const previous = debt.balanceUsd;
      const balanceChanged = updated.balanceUsd !== previous;
      const kind = balanceChanged ? balanceChangeKind(edit.reason, previous, updated.balanceUsd) : null;
      if (balanceChanged) ledger.roomForOneMore();
      Object.assign(debt, updated, { updatedAt: now().toISOString() });
      if (kind) ledger.debtEdited(debt, previous, kind, edit);
      return view(debt);
    },

    deleteDebt: async (id: string): Promise<void> => {
      const index = debts.findIndex((d) => d.id === id);
      if (index < 0) throw new ApiError(404, `Debt ${id} not found`);
      ledger.debtClosed(debts[index]);
      debts.splice(index, 1);
    },
  };
}
