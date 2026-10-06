import type {
  BalanceChangeReason,
  Debt,
  Holding,
  Movement,
  MovementDebt,
  MovementHolding,
  MovementKind,
  MovementPage,
  MovementsSummary,
  SummaryBucket,
  ValueChangeReason,
} from '@/types/wealth';
import type { MovementInput, MovementQuery } from './api';
import { ApiError } from './apiError';
import { exactUsd } from './money';

// The API's activity log (base_project_go: MovementService), in memory: the same kinds, effects, limits,
// order and messages. Holdings and debts keep their current value; movements say how it got there.

const MAX_MOVEMENTS = 20_000;
const MAX_NOTE = 200;
const MAX_AMOUNT = 1e15;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEBT_KINDS: MovementKind[] = ['DEBT_PAYMENT', 'DEBT_CHARGE', 'DEBT_INTEREST'];
const RECORDABLE: MovementKind[] = ['GAIN', 'LOSS', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', ...DEBT_KINDS];
const ALL_KINDS: MovementKind[] = ['OPENING', 'CLOSING', 'GAIN', 'LOSS', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'ADJUSTMENT', ...DEBT_KINDS];
const REASONS: (ValueChangeReason | '')[] = ['', 'MARKET', 'CASH_FLOW', 'CORRECTION'];
const SUMMARY_BUCKETS: SummaryBucket[] = [
  'GAIN', 'LOSS', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'TRANSFER_FEES', 'OPENING', 'CLOSING', 'ADJUSTMENT', 'DEBT_OPENING',
  'DEBT_CLOSING', 'DEBT_PAYMENT_EXTERNAL', 'DEBT_PAYMENT_FROM_ASSET', 'DEBT_CHARGE_EXTERNAL', 'DEBT_CHARGE_TO_ASSET', 'DEBT_INTEREST',
];
const BALANCE_REASONS: (BalanceChangeReason | '')[] = ['', 'PAYMENT', 'CHARGE', 'INTEREST', 'CORRECTION'];

const WHY_NOT_BELOW_ZERO: Partial<Record<MovementKind, string>> = {
  LOSS: "a loss can't be larger than that.",
  WITHDRAWAL: "you can't withdraw more than that.",
  TRANSFER: "you can't transfer more than that.",
  DEBT_PAYMENT: "you can't pay more than that.",
};

/** A debt as the mock keeps it: what the API stores, without its payoff (worked out when it's read). */
export type MockDebt = Omit<Debt, 'payoff'>;

type Ref = Omit<MovementHolding, 'exists'>;
type DebtRef = Omit<MovementDebt, 'exists'>;
type Stored = Omit<Movement, 'revertible' | 'holding' | 'toHolding' | 'debt'> & {
  holding: Ref | null;
  toHolding: Ref | null;
  debt: DebtRef | null;
};
type FieldError = { field: string; message: string };

const cents = (n: number) => Math.round(n * 100) / 100;
const refOf = (h: Holding): Ref => ({ id: h.id, name: h.name, platform: h.platform, assetClass: h.assetClass });
const debtRefOf = (d: MockDebt): DebtRef => ({ id: d.id, name: d.name, lender: d.lender });
const invalid = (errors: FieldError[]) => new ApiError(400, errors.map((e) => e.message).join('; '), errors);
const insufficient = (h: Holding, why: string) => new ApiError(409, `${h.name} is worth ${exactUsd(h.valueUsd)}: ${why}`);
// JSON has no NaN or Infinity: the API gets null for them, which it reads as 0.
const sent = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : 0);
const isDebtKind = (kind: MovementKind) => DEBT_KINDS.includes(kind);

/** What a movement did to holding values: signed changes, undone with the signs flipped. */
function effect(m: Stored): [holdingId: string, delta: number][] {
  const amount = m.amountUsd;
  switch (m.kind) {
    case 'OPENING':
    case 'GAIN':
    case 'DEPOSIT':
      return m.holding ? [[m.holding.id, amount]] : [];
    case 'CLOSING':
    case 'LOSS':
    case 'WITHDRAWAL':
    case 'DEBT_PAYMENT':
      return m.holding ? [[m.holding.id, -amount]] : [];
    case 'TRANSFER':
      return [
        [m.holding!.id, -amount],
        [m.toHolding!.id, cents(amount - (m.feeUsd ?? 0))],
      ];
    case 'DEBT_CHARGE':
      return m.toHolding ? [[m.toHolding.id, amount]] : [];
    case 'ADJUSTMENT':
      return m.holding ? [[m.holding.id, cents(m.newValueUsd! - m.previousValueUsd!)]] : [];
    case 'DEBT_INTEREST':
      return [];
  }
}

/** What a movement did to its debt's balance (positive: more owed), or null when it isn't about one. */
function debtEffect(m: Stored): number | null {
  if (!m.debt) return null;
  switch (m.kind) {
    case 'OPENING':
    case 'DEBT_CHARGE':
    case 'DEBT_INTEREST':
      return m.amountUsd;
    case 'CLOSING':
    case 'DEBT_PAYMENT':
      return -m.amountUsd;
    case 'ADJUSTMENT':
      return cents(m.newValueUsd! - m.previousValueUsd!);
    default:
      return null;
  }
}

/** What an edit of a debt's balance is recorded as, for this reason (the API refuses a reason going the other way). */
export function balanceChangeKind(reason: BalanceChangeReason, previous: number, next: number): MovementKind {
  const up = next > previous;
  if (reason === 'PAYMENT') {
    if (up) throw new ApiError(400, 'A payment can only lower the balance');
    return 'DEBT_PAYMENT';
  }
  if (reason === 'CHARGE' || reason === 'INTEREST') {
    if (!up) throw new ApiError(400, 'New charges and interest can only raise the balance');
    return reason === 'CHARGE' ? 'DEBT_CHARGE' : 'DEBT_INTEREST';
  }
  return 'ADJUSTMENT';
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

// A date (YYYY-MM-DD: that day at the given UTC time) or an RFC 3339 instant, as the API reads them; null
// when it's neither. Unlike Date's parser, there's no February 30.
export function parseWhen(raw: string, dayTime: string): Date | null {
  const parts = DATE.exec(raw) ?? INSTANT.exec(raw);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1, 4).map(Number);
  if (month < 1 || month > 12 || new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;
  const at = new Date(DATE.test(raw) ? `${raw}T${dayTime}Z` : raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

export const BAD_WHEN = (field: string) => `${field} must be a date (YYYY-MM-DD) or a date and time (RFC 3339)`;

// When a movement happened: a date is noon UTC (no time zone within ±11 h moves it to another day); not
// before 1970, not after tomorrow (a day of slack for time zones ahead of the server's).
function occurredAt(raw: string | undefined, now: Date): string {
  if (!raw) return now.toISOString();
  const at = parseWhen(raw, '12:00:00.000');
  if (!at) throw invalid([{ field: 'occurredAt', message: BAD_WHEN('occurredAt') }]);
  if (at.getTime() < 0 || at.getTime() > now.getTime() + DAY_MS) {
    throw new ApiError(400, "occurredAt can't be in the future or before 1970");
  }
  return at.toISOString();
}

function note(raw: string | undefined): string | null {
  const text = (raw ?? '').trim();
  const length = [...text].length;
  if (length > MAX_NOTE) throw new ApiError(400, `Note exceeds max length (${length} > ${MAX_NOTE})`);
  return text || null;
}

// Money as the API keeps it: 2 decimals, never negative.
function money(value: number): number {
  if (value < 0) throw new ApiError(400, `money must not be negative: ${value}`);
  return cents(value);
}

const newer = (a: Stored, b: Stored) =>
  a.occurredAt !== b.occurredAt ? a.occurredAt > b.occurredAt : a.createdAt !== b.createdAt ? a.createdAt > b.createdAt : a.id > b.id;

const encodeCursor = (m: Stored) => btoa(JSON.stringify([m.occurredAt, m.createdAt, m.id]));

function decodeCursor(cursor: string): Stored | null {
  try {
    const [o, c, id] = JSON.parse(atob(cursor)) as unknown[];
    if ([o, c, id].every((part) => typeof part === 'string')) return { occurredAt: o, createdAt: c, id } as Stored;
  } catch {
    // Not one this API gave.
  }
  return null;
}

/** A holding to be added, validated as POST /holdings validates one: its cap is checked, then it's added. */
export interface NewHolding {
  checkCap: () => void;
  add: () => Holding;
}

export interface LedgerStore {
  holdings: Holding[];
  debts: MockDebt[];
  now: () => Date;
  /** Validates a holding as POST /holdings does (its value is 0), to add it later. */
  newHolding: (input: { name: string; assetClass: string; platform: string }) => NewHolding;
}

export function createMockLedger({ holdings, debts, now, newHolding }: LedgerStore) {
  const movements: Stored[] = [];
  // How many count toward the quota: all but CLOSINGs (removing a holding or a debt always works).
  let counted = 0;
  const keep = (m: Stored) => {
    movements.push(m);
    if (m.kind !== 'CLOSING') counted++;
    return m;
  };
  let nextId = 1;
  const id = () => `mov-${String(nextId++).padStart(6, '0')}`;
  const find = (holdingId: string) => {
    const h = holdings.find((x) => x.id === holdingId);
    if (!h) throw new ApiError(404, `Holding ${holdingId} not found`);
    return h;
  };
  const findDebt = (debtId: string) => {
    const d = debts.find((x) => x.id === debtId);
    if (!d) throw new ApiError(404, `Debt ${debtId} not found`);
    return d;
  };
  const roomForOneMore = () => {
    if (counted >= MAX_MOVEMENTS) {
      throw new ApiError(409, `You've reached the limit of ${MAX_MOVEMENTS} recorded changes. Undo some to record new ones.`);
    }
  };
  const store = (m: Omit<Stored, 'id' | 'createdAt'> & { createdAt?: string }): Stored =>
    keep({ ...m, id: id(), createdAt: m.createdAt ?? now().toISOString() });
  const view = (m: Stored): Movement => {
    const exists = (ref: Ref | null) => !!ref && holdings.some((h) => h.id === ref.id);
    const holding = m.holding && { ...m.holding, exists: exists(m.holding) };
    const toHolding = m.toHolding && { ...m.toHolding, exists: exists(m.toHolding) };
    const debt = m.debt && { ...m.debt, exists: debts.some((d) => d.id === m.debt!.id) };
    const revertible =
      m.kind !== 'OPENING' &&
      m.kind !== 'CLOSING' &&
      (!holding || holding.exists) &&
      (!toHolding || toHolding.exists) &&
      (!debt || debt.exists);
    return { ...m, holding, toHolding, debt, revertible };
  };
  const nothing = { feeUsd: null, holding: null, toHolding: null, debt: null, previousValueUsd: null, newValueUsd: null, note: null };
  const lifecycle = (kind: 'OPENING' | 'CLOSING', h: Holding, at = now().toISOString()) =>
    store({ ...nothing, kind, occurredAt: at, createdAt: at, amountUsd: h.valueUsd, holding: refOf(h) });
  const debtLifecycle = (kind: 'OPENING' | 'CLOSING', d: MockDebt, at = now().toISOString()) =>
    store({ ...nothing, kind, occurredAt: at, createdAt: at, amountUsd: d.balanceUsd, debt: debtRefOf(d) });

  // A transfer's holdings, checked as the API checks them (every problem at once).
  function transferErrors(input: Extract<MovementInput, { kind: 'TRANSFER' }>) {
    const errors: FieldError[] = [];
    if (!input.fromHoldingId) errors.push({ field: 'fromHoldingId', message: 'fromHoldingId is required' });
    if (!input.toHoldingId === !input.toNewHolding) {
      errors.push({ field: 'toHoldingId', message: 'Send either toHoldingId or toNewHolding' });
    }
    if (input.fromHoldingId && input.toHoldingId === input.fromHoldingId) {
      errors.push({ field: 'toHoldingId', message: 'Pick a different destination' });
    }
    return errors;
  }

  // A debt's payment, charge or interest: the debt's balance changes, and so does the holding the money came
  // from (a payment) or went to (a charge), if one is named.
  function debtMovement(input: Extract<MovementInput, { debtId: string }>, value: number, at: string, text: string | null) {
    if (!input.debtId) throw invalid([{ field: 'debtId', message: 'debtId is required' }]);
    const d = findDebt(input.debtId);
    const holdingId =
      input.kind === 'DEBT_PAYMENT' ? input.fromHoldingId : input.kind === 'DEBT_CHARGE' ? input.toHoldingId : undefined;
    const h = holdingId ? find(holdingId) : null;
    const delta = input.kind === 'DEBT_PAYMENT' ? -value : value;
    if (cents(d.balanceUsd + delta) < 0) throw new ApiError(409, `${d.name} only has ${exactUsd(d.balanceUsd)} left to pay.`);
    if (h && input.kind === 'DEBT_PAYMENT' && cents(h.valueUsd - value) < 0) throw insufficient(h, WHY_NOT_BELOW_ZERO.DEBT_PAYMENT!);
    roomForOneMore();
    const [debtRef, ref] = [debtRefOf(d), h && refOf(h)];
    const stamp = now().toISOString();
    d.balanceUsd = cents(d.balanceUsd + delta);
    d.updatedAt = stamp;
    if (h) {
      h.valueUsd = cents(h.valueUsd + (input.kind === 'DEBT_PAYMENT' ? -value : value));
      h.updatedAt = stamp;
    }
    return view(
      store({
        ...nothing, kind: input.kind, occurredAt: at, amountUsd: value, note: text, debt: debtRef,
        holding: input.kind === 'DEBT_PAYMENT' ? ref : null, toHolding: input.kind === 'DEBT_CHARGE' ? ref : null,
      }),
    );
  }

  return {
    /** Counts toward the quota before a holding or a debt is added (its OPENING). */
    roomForOneMore,
    opened: (h: Holding, at?: string) => void lifecycle('OPENING', h, at),
    closed: (h: Holding) => void lifecycle('CLOSING', h),
    debtOpened: (d: MockDebt) => void debtLifecycle('OPENING', d),
    debtClosed: (d: MockDebt) => void debtLifecycle('CLOSING', d),

    /** Checks what an edit of a debt's balance would carry, before anything changes. */
    checkDebtEdit(reason: string | undefined, rawOccurredAt: string | undefined, rawNote: string | undefined) {
      if (reason !== undefined && !BALANCE_REASONS.includes(reason as BalanceChangeReason)) {
        throw new ApiError(400, `balanceChangeReason must be one of PAYMENT, CHARGE, INTEREST, CORRECTION (got "${reason}")`);
      }
      const text = note(rawNote);
      return { reason: (reason || 'CORRECTION') as BalanceChangeReason, at: occurredAt(rawOccurredAt, now()), note: text };
    },

    /** Records an edit of a debt's balance (d as it is after it), as kind. */
    debtEdited(d: MockDebt, previous: number, kind: MovementKind, edit: { at: string; note: string | null }) {
      const next = d.balanceUsd;
      store({
        ...nothing, kind, occurredAt: edit.at, amountUsd: cents(Math.abs(next - previous)), debt: debtRefOf(d),
        previousValueUsd: previous, newValueUsd: next, note: edit.note,
      });
    },

    /** Checks what an edit's movement would carry, before anything changes (as the API validates first). */
    checkEdit(reason: string | undefined, rawOccurredAt: string | undefined, rawNote: string | undefined) {
      if (reason !== undefined && !REASONS.includes(reason as ValueChangeReason)) {
        throw new ApiError(400, `valueChangeReason must be one of MARKET, CASH_FLOW, CORRECTION (got "${reason}")`);
      }
      const text = note(rawNote);
      return { reason: (reason || 'MARKET') as ValueChangeReason, at: occurredAt(rawOccurredAt, now()), note: text };
    },

    /** Records an edit of a holding's value (h as it is after it), as what the reason says it was. */
    edited(h: Holding, previous: number, edit: { reason: ValueChangeReason; at: string; note: string | null }) {
      const next = h.valueUsd;
      const up = next > previous;
      const kind: MovementKind =
        edit.reason === 'CORRECTION' ? 'ADJUSTMENT' : edit.reason === 'CASH_FLOW' ? (up ? 'DEPOSIT' : 'WITHDRAWAL') : up ? 'GAIN' : 'LOSS';
      store({
        ...nothing, kind, occurredAt: edit.at, amountUsd: cents(Math.abs(next - previous)), holding: refOf(h),
        previousValueUsd: previous, newValueUsd: next, note: edit.note,
      });
    },

    record(input: MovementInput): Movement {
      const fee = input.kind === 'TRANSFER' ? sent(input.feeUsd) : 0;
      if (sent(input.amountUsd) > MAX_AMOUNT || fee > MAX_AMOUNT) {
        throw invalid([{ field: 'amountUsd', message: 'Amount is too large' }]);
      }
      if (input.occurredAt && !parseWhen(input.occurredAt, '12:00:00.000')) {
        throw invalid([{ field: 'occurredAt', message: BAD_WHEN('occurredAt') }]);
      }
      if (!RECORDABLE.includes(input.kind)) {
        throw invalid([{ field: 'kind', message: 'kind must be one of GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, DEBT_PAYMENT, DEBT_CHARGE, DEBT_INTEREST' }]);
      }
      const value = money(sent(input.amountUsd));
      if (value === 0) throw new ApiError(400, 'amount must be greater than 0');
      const text = note(input.note);
      const at = occurredAt(input.occurredAt, now());

      if (input.kind === 'DEBT_PAYMENT' || input.kind === 'DEBT_CHARGE' || input.kind === 'DEBT_INTEREST') {
        return debtMovement(input, value, at, text);
      }
      if (input.kind !== 'TRANSFER') {
        if (!input.holdingId) throw invalid([{ field: 'holdingId', message: 'holdingId is required' }]);
        const h = find(input.holdingId);
        const delta = input.kind === 'GAIN' || input.kind === 'DEPOSIT' ? value : -value;
        if (cents(h.valueUsd + delta) < 0) throw insufficient(h, WHY_NOT_BELOW_ZERO[input.kind]!);
        roomForOneMore();
        const ref = refOf(h);
        h.valueUsd = cents(h.valueUsd + delta);
        h.updatedAt = now().toISOString();
        return view(store({ ...nothing, kind: input.kind, occurredAt: at, amountUsd: value, holding: ref, note: text }));
      }

      const errors = transferErrors(input);
      if (errors.length) throw invalid(errors);
      const feeUsd = money(fee);
      if (feeUsd > value) throw new ApiError(400, "fee can't be larger than the amount");
      // A new destination is validated like any new holding, before anything is read.
      const fresh = input.toNewHolding ? newHolding(input.toNewHolding) : null;

      const from = find(input.fromHoldingId);
      const to = input.toHoldingId ? find(input.toHoldingId) : null;
      fresh?.checkCap();
      if (cents(from.valueUsd - value) < 0) throw insufficient(from, WHY_NOT_BELOW_ZERO.TRANSFER!);
      roomForOneMore();
      // A destination added by the transfer is opened by it: no OPENING of its own.
      const destination = to ?? fresh!.add();
      const [fromRef, toRef] = [refOf(from), refOf(destination)];
      const stamp = now().toISOString();
      from.valueUsd = cents(from.valueUsd - value);
      destination.valueUsd = cents(destination.valueUsd + value - feeUsd);
      from.updatedAt = destination.updatedAt = stamp;
      return view(store({ ...nothing, kind: 'TRANSFER', occurredAt: at, amountUsd: value, feeUsd, holding: fromRef, toHolding: toRef, note: text }));
    },

    list(query: MovementQuery = {}): MovementPage {
      const errors: FieldError[] = [];
      if (query.kinds?.some((k) => !ALL_KINDS.includes(k))) {
        errors.push({
          field: 'kind',
          message: `kind must be a comma-separated list of ${ALL_KINDS.join(', ')}`,
        });
      }
      // A date covers the whole UTC day: from its first instant, to its last.
      const bound = (field: 'from' | 'to', dayTime: string) => {
        const raw = query[field];
        if (!raw) return null;
        const at = parseWhen(raw, dayTime);
        if (!at) errors.push({ field, message: BAD_WHEN(field) });
        return at?.toISOString() ?? null;
      };
      const [from, to] = [bound('from', '00:00:00.000'), bound('to', '23:59:59.999')];
      const limit = query.limit || 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) errors.push({ field: 'limit', message: 'limit must be between 1 and 200' });
      const cut = query.cursor ? decodeCursor(query.cursor) : null;
      if (query.cursor && !cut) errors.push({ field: 'cursor', message: 'cursor is not one this API gave' });
      if (errors.length) throw invalid(errors);

      const list = movements
        .filter(
          (m) =>
            (!query.holdingId || m.holding?.id === query.holdingId || m.toHolding?.id === query.holdingId) &&
            (!query.debtId || m.debt?.id === query.debtId) &&
            (!query.kinds?.length || query.kinds.includes(m.kind)) &&
            (!from || m.occurredAt >= from) &&
            (!to || m.occurredAt <= to) &&
            (!cut || newer(cut, m)),
        )
        .sort((a, b) => (newer(a, b) ? -1 : 1));
      const items = list.slice(0, limit);
      return {
        items: items.map(view),
        nextCursor: list.length > limit ? encodeCursor(items[items.length - 1]) : null,
      };
    },

    /**
     * What the movements of [from, to] add up to, by bucket, and what they did to the net worth
     * (base_project_go service.MovementsEffect): transfers, and debt payments from (or charges into) an asset,
     * leave it as it was but for their fee.
     */
    summary(period: { from?: string; to?: string } = {}): MovementsSummary {
      const errors: FieldError[] = [];
      const bound = (field: 'from' | 'to', dayTime: string, otherwise: string) => {
        const raw = period[field];
        if (!raw) return otherwise;
        const at = parseWhen(raw, dayTime);
        if (!at) errors.push({ field, message: BAD_WHEN(field) });
        return at?.toISOString() ?? otherwise;
      };
      const from = bound('from', '00:00:00.000', '1970-01-01T00:00:00.000Z');
      const to = bound('to', '23:59:59.999', now().toISOString());
      if (errors.length) throw invalid(errors);
      if (from > to) throw invalid([{ field: 'from', message: 'from must not be after to' }]);

      const totals = Object.fromEntries(SUMMARY_BUCKETS.map((b) => [b, 0])) as Record<SummaryBucket, number>;
      const add = (b: SummaryBucket, v: number) => (totals[b] += v);
      let count = 0;
      let transfers = 0;
      for (const m of movements) {
        if (m.occurredAt < from || m.occurredAt > to) continue;
        count++;
        const amount = m.amountUsd;
        switch (m.kind) {
          case 'OPENING':
            add(m.debt ? 'DEBT_OPENING' : 'OPENING', amount);
            break;
          case 'CLOSING':
            add(m.debt ? 'DEBT_CLOSING' : 'CLOSING', amount);
            break;
          case 'TRANSFER':
            add('TRANSFER', amount);
            add('TRANSFER_FEES', m.feeUsd ?? 0);
            transfers++;
            break;
          case 'ADJUSTMENT': {
            // A debt's balance going up lowers the net worth.
            const change = (m.newValueUsd ?? 0) - (m.previousValueUsd ?? 0);
            add('ADJUSTMENT', m.debt ? -change : change);
            break;
          }
          case 'DEBT_PAYMENT':
            add(m.holding ? 'DEBT_PAYMENT_FROM_ASSET' : 'DEBT_PAYMENT_EXTERNAL', amount);
            if (m.holding) transfers++;
            break;
          case 'DEBT_CHARGE':
            add(m.toHolding ? 'DEBT_CHARGE_TO_ASSET' : 'DEBT_CHARGE_EXTERNAL', amount);
            if (m.toHolding) transfers++;
            break;
          default:
            add(m.kind, amount); // GAIN, LOSS, DEPOSIT, WITHDRAWAL, DEBT_INTEREST
        }
      }
      for (const b of SUMMARY_BUCKETS) totals[b] = cents(totals[b]);
      const t = totals;
      return {
        from,
        to,
        count,
        transfers,
        totalsUsd: totals,
        netWorthEffectUsd: {
          investments: cents(t.GAIN - t.LOSS - t.TRANSFER_FEES - t.DEBT_INTEREST),
          saving: cents(t.DEPOSIT - t.WITHDRAWAL + t.DEBT_PAYMENT_EXTERNAL - t.DEBT_CHARGE_EXTERNAL),
          addedRemoved: cents(t.OPENING - t.CLOSING + t.DEBT_CLOSING - t.DEBT_OPENING),
          corrections: cents(t.ADJUSTMENT),
        },
      };
    },

    revert(movementId: string) {
      const index = movements.findIndex((m) => m.id === movementId);
      if (index < 0) throw new ApiError(404, `Movement ${movementId} not found`);
      const m = movements[index];
      if (m.kind === 'OPENING' || m.kind === 'CLOSING') {
        throw new ApiError(409, `Adding or removing ${m.debt ? 'a debt' : 'an asset'} can't be undone here: remove it, or add it again.`);
      }
      const changes = effect(m).map(([holdingId, delta]) => {
        const h = holdings.find((x) => x.id === holdingId);
        const name = m.toHolding?.id === holdingId ? m.toHolding.name : m.holding!.name;
        if (!h) throw new ApiError(409, `${name} was removed, so this can't be undone.`);
        if (cents(h.valueUsd - delta) < 0) throw insufficient(h, 'undoing this would take it below zero.');
        return [h, delta] as const;
      });
      const debtDelta = debtEffect(m);
      let debt: MockDebt | undefined;
      if (debtDelta !== null) {
        debt = debts.find((d) => d.id === m.debt!.id);
        if (!debt) throw new ApiError(409, `${m.debt!.name} was removed, so this can't be undone.`);
        if (cents(debt.balanceUsd - debtDelta) < 0) {
          throw new ApiError(409, `${debt.name} has ${exactUsd(debt.balanceUsd)} left to pay: undoing this would take it below zero.`);
        }
      }
      const stamp = now().toISOString();
      for (const [h, delta] of changes) {
        h.valueUsd = cents(h.valueUsd - delta);
        h.updatedAt = stamp;
      }
      if (debt) {
        debt.balanceUsd = cents(debt.balanceUsd - debtDelta!);
        debt.updatedAt = stamp;
      }
      movements.splice(index, 1);
      counted--;
    },

    /** A past movement for the demo's history (values are seeded as they end up). */
    seed(
      m: Omit<Stored, 'id' | 'holding' | 'toHolding' | 'debt'> & { holding?: Holding; toHolding?: Holding; debt?: MockDebt },
    ) {
      keep({
        ...m,
        id: id(),
        holding: m.holding ? refOf(m.holding) : null,
        toHolding: m.toHolding ? refOf(m.toHolding) : null,
        debt: m.debt ? debtRefOf(m.debt) : null,
      });
    },
  };
}

export type MockLedger = ReturnType<typeof createMockLedger>;
