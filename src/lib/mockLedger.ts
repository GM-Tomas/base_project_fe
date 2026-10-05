import type { Holding, Movement, MovementHolding, MovementKind, MovementPage, ValueChangeReason } from '@/types/wealth';
import type { MovementInput, MovementQuery } from './api';
import { ApiError } from './apiError';
import { formatUsd } from './money';

// The API's activity log (base_project_go: MovementService), in memory: the same kinds, effects, limits,
// order and messages. Holdings keep their current value; movements say how it got there.

const MAX_MOVEMENTS = 20_000;
const MAX_NOTE = 200;
const MAX_AMOUNT = 1e15;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECORDABLE: MovementKind[] = ['GAIN', 'LOSS', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER'];
const ALL_KINDS: MovementKind[] = ['OPENING', 'CLOSING', ...RECORDABLE, 'ADJUSTMENT'];
const REASONS: (ValueChangeReason | '')[] = ['', 'MARKET', 'CASH_FLOW', 'CORRECTION'];

const WHY_NOT_BELOW_ZERO: Partial<Record<MovementKind, string>> = {
  LOSS: "a loss can't be larger than that.",
  WITHDRAWAL: "you can't withdraw more than that.",
  TRANSFER: "you can't transfer more than that.",
};

type Ref = Omit<MovementHolding, 'exists'>;
type Stored = Omit<Movement, 'revertible' | 'holding' | 'toHolding'> & { holding: Ref | null; toHolding: Ref | null };
type FieldError = { field: string; message: string };

const cents = (n: number) => Math.round(n * 100) / 100;
const refOf = (h: Holding): Ref => ({ id: h.id, name: h.name, platform: h.platform, assetClass: h.assetClass });
const invalid = (errors: FieldError[]) => new ApiError(400, errors.map((e) => e.message).join('; '), errors);
const insufficient = (h: Holding, why: string) => new ApiError(409, `${h.name} is worth ${formatUsd(h.valueUsd)}: ${why}`);
// JSON has no NaN or Infinity: the API gets null for them, which it reads as 0.
const sent = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : 0);

/** What a movement did to holding values: signed changes, undone with the signs flipped. */
function effect(m: Stored): [holdingId: string, delta: number][] {
  const own = m.holding!.id;
  switch (m.kind) {
    case 'OPENING':
    case 'GAIN':
    case 'DEPOSIT':
      return [[own, m.amountUsd]];
    case 'CLOSING':
    case 'LOSS':
    case 'WITHDRAWAL':
      return [[own, -m.amountUsd]];
    case 'TRANSFER':
      return [
        [own, -m.amountUsd],
        [m.toHolding!.id, cents(m.amountUsd - (m.feeUsd ?? 0))],
      ];
    case 'ADJUSTMENT':
      return [[own, cents(m.newValueUsd! - m.previousValueUsd!)]];
  }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

// A date (YYYY-MM-DD: that day at the given UTC time) or an RFC 3339 instant, as the API reads them; null
// when it's neither. Unlike Date's parser, there's no February 30.
function parseWhen(raw: string, dayTime: string): Date | null {
  const parts = DATE.exec(raw) ?? INSTANT.exec(raw);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1, 4).map(Number);
  if (month < 1 || month > 12 || new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;
  const at = new Date(DATE.test(raw) ? `${raw}T${dayTime}Z` : raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

const BAD_WHEN = (field: string) => `${field} must be a date (YYYY-MM-DD) or a date and time (RFC 3339)`;

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
  now: () => Date;
  /** Validates a holding as POST /holdings does (its value is 0), to add it later. */
  newHolding: (input: { name: string; assetClass: string; platform: string }) => NewHolding;
}

export function createMockLedger({ holdings, now, newHolding }: LedgerStore) {
  const movements: Stored[] = [];
  // How many count toward the quota: all but CLOSINGs (removing a holding always works).
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
    const revertible =
      m.kind !== 'OPENING' && m.kind !== 'CLOSING' && (!holding || holding.exists) && (!toHolding || toHolding.exists);
    return { ...m, holding, toHolding, revertible };
  };
  const lifecycle = (kind: 'OPENING' | 'CLOSING', h: Holding, at = now().toISOString()) =>
    store({
      kind, occurredAt: at, createdAt: at, amountUsd: h.valueUsd, feeUsd: null, holding: refOf(h), toHolding: null,
      previousValueUsd: null, newValueUsd: null, note: null,
    });

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

  return {
    /** Counts toward the quota before a holding is added (its OPENING). */
    roomForOneMore,
    opened: (h: Holding, at?: string) => void lifecycle('OPENING', h, at),
    closed: (h: Holding) => void lifecycle('CLOSING', h),

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
        kind, occurredAt: edit.at, amountUsd: cents(Math.abs(next - previous)), feeUsd: null, holding: refOf(h),
        toHolding: null, previousValueUsd: previous, newValueUsd: next, note: edit.note,
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
        throw invalid([{ field: 'kind', message: 'kind must be one of GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER' }]);
      }
      const value = money(sent(input.amountUsd));
      if (value === 0) throw new ApiError(400, 'amount must be greater than 0');
      const text = note(input.note);
      const at = occurredAt(input.occurredAt, now());

      if (input.kind !== 'TRANSFER') {
        if (!input.holdingId) throw invalid([{ field: 'holdingId', message: 'holdingId is required' }]);
        const h = find(input.holdingId);
        const delta = input.kind === 'GAIN' || input.kind === 'DEPOSIT' ? value : -value;
        if (cents(h.valueUsd + delta) < 0) throw insufficient(h, WHY_NOT_BELOW_ZERO[input.kind]!);
        roomForOneMore();
        const ref = refOf(h);
        h.valueUsd = cents(h.valueUsd + delta);
        h.updatedAt = now().toISOString();
        return view(store({ kind: input.kind, occurredAt: at, amountUsd: value, feeUsd: null, holding: ref, toHolding: null, previousValueUsd: null, newValueUsd: null, note: text }));
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
      return view(store({ kind: 'TRANSFER', occurredAt: at, amountUsd: value, feeUsd, holding: fromRef, toHolding: toRef, previousValueUsd: null, newValueUsd: null, note: text }));
    },

    list(query: MovementQuery = {}): MovementPage {
      const errors: FieldError[] = [];
      if (query.kinds?.some((k) => !ALL_KINDS.includes(k))) {
        errors.push({ field: 'kind', message: 'kind must be a comma-separated list of OPENING, CLOSING, GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, ADJUSTMENT' });
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

    revert(movementId: string) {
      const index = movements.findIndex((m) => m.id === movementId);
      if (index < 0) throw new ApiError(404, `Movement ${movementId} not found`);
      const m = movements[index];
      if (m.kind === 'OPENING' || m.kind === 'CLOSING') {
        throw new ApiError(409, "Adding or removing an asset can't be undone here: remove the asset, or add it again.");
      }
      const changes = effect(m).map(([holdingId, delta]) => {
        const h = holdings.find((x) => x.id === holdingId);
        const name = m.toHolding?.id === holdingId ? m.toHolding.name : m.holding!.name;
        if (!h) throw new ApiError(409, `${name} was removed, so this can't be undone.`);
        if (cents(h.valueUsd - delta) < 0) throw insufficient(h, 'undoing this would take it below zero.');
        return [h, delta] as const;
      });
      const stamp = now().toISOString();
      for (const [h, delta] of changes) {
        h.valueUsd = cents(h.valueUsd - delta);
        h.updatedAt = stamp;
      }
      movements.splice(index, 1);
      counted--;
    },

    /** A past movement for the demo's history (values are seeded as they end up). */
    seed(m: Omit<Stored, 'id' | 'holding' | 'toHolding'> & { holding: Holding; toHolding?: Holding }) {
      keep({ ...m, id: id(), holding: refOf(m.holding), toHolding: m.toHolding ? refOf(m.toHolding) : null });
    },
  };
}

export type MockLedger = ReturnType<typeof createMockLedger>;
