import type { Movement, MovementDebt, MovementHolding, MovementKind } from '@/types/wealth';
import { formatUsd } from './money';
import { intlLocale, messages } from './i18n';
import type { Messages } from '@/i18n/en';

// How the activity log reads: what each kind is called, what a movement did to a holding or a debt, how it's
// described in a list, and the dates the dialogs send.

/** The kinds users record on one holding (a transfer has its own dialog). */
export type RecordableKind = 'GAIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL';

/** What happens to a debt that users record. */
export type DebtMovementKind = 'DEBT_PAYMENT' | 'DEBT_CHARGE' | 'DEBT_INTEREST';

/** What a kind of movement is called, in the app's language: "Gain", "New charge". */
export const kindLabel = (kind: MovementKind) => messages().movements.kinds[kind];

export type KindGroup = keyof Messages['movements']['groups'];

/** The Activity filter, in the order it offers them (its label is the group's, in the app's language). */
export const KIND_GROUPS: { id: KindGroup; kinds: MovementKind[] }[] = [
  { id: 'gainsLosses', kinds: ['GAIN', 'LOSS'] },
  { id: 'depositsWithdrawals', kinds: ['DEPOSIT', 'WITHDRAWAL'] },
  { id: 'transfers', kinds: ['TRANSFER'] },
  { id: 'debts', kinds: ['DEBT_PAYMENT', 'DEBT_CHARGE', 'DEBT_INTEREST'] },
  { id: 'addedRemoved', kinds: ['OPENING', 'CLOSING'] },
  { id: 'corrections', kinds: ['ADJUSTMENT'] },
];

/** Whose activity a list shows: one holding's, one debt's, or everything (neither). */
export interface Scope {
  holdingId?: string;
  debtId?: string;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** What a movement did to each holding's value: signed changes (undoing it applies them flipped). */
export function effects(m: Movement): [holding: MovementHolding, delta: number][] {
  const amount = m.amountUsd;
  switch (m.kind) {
    case 'OPENING':
    case 'GAIN':
    case 'DEPOSIT':
      return m.holding ? [[m.holding, amount]] : [];
    case 'CLOSING':
    case 'LOSS':
    case 'WITHDRAWAL':
    case 'DEBT_PAYMENT':
      return m.holding ? [[m.holding, -amount]] : [];
    case 'TRANSFER':
      return [
        [m.holding!, -amount],
        [m.toHolding!, cents(amount - (m.feeUsd ?? 0))],
      ];
    case 'DEBT_CHARGE':
      return m.toHolding ? [[m.toHolding, amount]] : [];
    case 'ADJUSTMENT':
      return m.holding ? [[m.holding, cents((m.newValueUsd ?? 0) - (m.previousValueUsd ?? 0))]] : [];
    case 'DEBT_INTEREST':
      return [];
  }
}

/** What a movement did to its debt's balance (positive: more owed), or null when it isn't about one. */
export function debtEffect(m: Movement): number | null {
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
      return cents((m.newValueUsd ?? 0) - (m.previousValueUsd ?? 0));
    default:
      return null;
  }
}

const signed = (delta: number) => `${delta < 0 ? '−' : '+'}${formatUsd(Math.abs(delta))}`;

export const nameOf = (h: MovementHolding | MovementDebt) => (h.exists ? h.name : messages().movements.deleted(h.name));

export type AmountTone = 'positive' | 'negative' | 'neutral';

/**
 * The amount a list shows for a movement: in one holding's activity, what it did to that holding; in one
 * debt's, what it did to what's owed; in the whole activity, what it did to what it's about (a transfer just
 * moved money, so it has no sign). Only what changes the net worth is colored: gains and losses, interest,
 * and a debt paid down. Adding or removing something shows its value then.
 */
export function amountOf(m: Movement, scope: Scope = {}): { text: string; tone: AmountTone } {
  const onAHolding = !!scope.holdingId;
  const tone: AmountTone =
    m.kind === 'GAIN'
      ? 'positive'
      : m.kind === 'LOSS' || m.kind === 'DEBT_INTEREST'
        ? 'negative'
        : m.kind === 'DEBT_PAYMENT' && !onAHolding
          ? 'positive'
          : 'neutral';
  if (m.kind === 'OPENING' || m.kind === 'CLOSING' || (m.kind === 'TRANSFER' && !onAHolding)) {
    return { text: formatUsd(m.amountUsd), tone };
  }
  if (!onAHolding && m.debt) return { text: signed(debtEffect(m) ?? 0), tone };
  const delta = effects(m).find(([h]) => h.id === (scope.holdingId ?? m.holding?.id))?.[1] ?? 0;
  return { text: signed(delta), tone };
}

// A debt movement's line: the debt (unless the list is its own), and the holding the money came from or
// went to.
function describeDebtMovement(m: Movement, scope: Scope): { title: string; details: string[] } {
  const t = messages().movements;
  const label = kindLabel(m.kind);
  const debt = m.debt!;
  const details: string[] = [];
  const title = scope.debtId ? label : `${label} · ${nameOf(debt)}`;
  if (!scope.debtId && debt.lender) details.push(debt.lender);
  if (m.kind === 'DEBT_PAYMENT' && m.holding && !scope.holdingId) details.push(t.from(nameOf(m.holding)));
  if (m.kind === 'DEBT_CHARGE' && m.toHolding && !scope.holdingId) details.push(t.into(nameOf(m.toHolding)));
  return { title, details };
}

/** A movement's line in a list: what happened (and to what, unless the list is its own), and the details. */
export function describe(m: Movement, scope: Scope = {}): { title: string; details: string[] } {
  const t = messages().movements;
  const label = kindLabel(m.kind);
  let title: string;
  let details: string[] = [];
  if (m.debt) {
    ({ title, details } = describeDebtMovement(m, scope));
  } else if (m.kind === 'TRANSFER') {
    const [from, to] = [m.holding!, m.toHolding!];
    if (scope.holdingId === from.id) {
      title = t.transferTo(label, nameOf(to));
      details.push(to.platform);
    } else if (scope.holdingId === to.id) {
      title = t.transferFrom(label, nameOf(from));
      details.push(from.platform);
    } else if (from.name === to.name) {
      // Same name on two platforms: the platforms tell them apart.
      title = `${label} · ${nameOf(from)} (${from.platform}) → ${nameOf(to)} (${to.platform})`;
    } else {
      title = `${label} · ${nameOf(from)} → ${nameOf(to)}`;
      details.push(from.platform === to.platform ? from.platform : `${from.platform} → ${to.platform}`);
    }
    if (m.feeUsd) details.push(t.fee(formatUsd(m.feeUsd)));
  } else {
    const holding = m.holding!;
    title = scope.holdingId ? label : `${label} · ${nameOf(holding)}`;
    if (!scope.holdingId) details.push(holding.platform);
  }
  if (m.previousValueUsd !== null && m.newValueUsd !== null) {
    details.push(`${formatUsd(m.previousValueUsd)} → ${formatUsd(m.newValueUsd)}`);
  }
  return { title, details };
}

/** What undoing a movement would do, for its confirmation: "Undoing it takes $50.00 off Bitcoin." */
export function undoSentence(m: Movement): string {
  const t = messages().movements;
  const parts = effects(m)
    .filter(([, delta]) => delta !== 0)
    .map(([h, delta]) => (delta > 0 ? t.takesOff(formatUsd(delta), h.name) : t.putsBack(formatUsd(-delta), h.name)));
  const owed = debtEffect(m);
  if (owed) parts.push(owed > 0 ? t.takesOffOwed(formatUsd(owed), m.debt!.name) : t.addsBackOwed(formatUsd(-owed), m.debt!.name));
  return parts.length ? t.undoing(parts) : t.undoingNothing;
}

/** "Sep 28, 2026" ("28 sept 2026" in Spanish), in the user's time zone. */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' });

/** Today in the user's time zone, as YYYY-MM-DD (what a date input holds). */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The occurredAt a dialog sends for a picked date: nothing for today, so the API stamps it with the time
 * (today's changes keep the order they were made in), else the date.
 */
export const occurredAtFor = (date: string, now: Date = new Date()) => (date === today(now) ? undefined : date);

/** What's wrong with a picked date, if anything (a date input's max doesn't stop typing). */
export function dateProblem(date: string, now: Date = new Date()): string | undefined {
  const t = messages().dates;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return t.pick;
  if (date > today(now)) return t.future;
  if (date < '1970-01-01') return t.before1970;
  return undefined;
}
