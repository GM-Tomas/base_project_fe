import type { Movement, MovementHolding, MovementKind } from '@/types/wealth';
import { formatUsd } from './money';

// How the activity log reads: what each kind is called, what a movement did to a holding, how it's
// described in a list, and the dates the dialogs send.

/** The kinds users record on one holding (a transfer has its own dialog). */
export type RecordableKind = 'GAIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL';

export const KIND_LABEL: Record<MovementKind, string> = {
  OPENING: 'Added',
  CLOSING: 'Removed',
  GAIN: 'Gain',
  LOSS: 'Loss',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Correction',
};

/** The Activity filter, in the order it offers them. */
export const KIND_GROUPS: { label: string; kinds: MovementKind[] }[] = [
  { label: 'Gains & losses', kinds: ['GAIN', 'LOSS'] },
  { label: 'Deposits & withdrawals', kinds: ['DEPOSIT', 'WITHDRAWAL'] },
  { label: 'Transfers', kinds: ['TRANSFER'] },
  { label: 'Added & removed', kinds: ['OPENING', 'CLOSING'] },
  { label: 'Corrections', kinds: ['ADJUSTMENT'] },
];

/** What a movement did to each holding's value: signed changes (undoing it applies them flipped). */
export function effects(m: Movement): [holding: MovementHolding, delta: number][] {
  const own = m.holding!;
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
        [m.toHolding!, cents(m.amountUsd - (m.feeUsd ?? 0))],
      ];
    case 'ADJUSTMENT':
      return [[own, cents((m.newValueUsd ?? 0) - (m.previousValueUsd ?? 0))]];
  }
}

const cents = (n: number) => Math.round(n * 100) / 100;

const signed = (delta: number) => `${delta < 0 ? '−' : '+'}${formatUsd(Math.abs(delta))}`;

export const nameOf = (h: MovementHolding) => (h.exists ? h.name : `${h.name} (deleted)`);

export type AmountTone = 'positive' | 'negative' | 'neutral';

/**
 * The amount a list shows for a movement: in one holding's activity, what it did to that holding; in the
 * whole activity, what it did to the holding it's about (a transfer just moved it, so it has no sign).
 * Only gains and losses are colored: the rest isn't performance. Adding or removing a holding shows the
 * value it had then.
 */
export function amountOf(m: Movement, holdingId?: string): { text: string; tone: AmountTone } {
  const tone: AmountTone = m.kind === 'GAIN' ? 'positive' : m.kind === 'LOSS' ? 'negative' : 'neutral';
  if (m.kind === 'OPENING' || m.kind === 'CLOSING' || (m.kind === 'TRANSFER' && !holdingId)) {
    return { text: formatUsd(m.amountUsd), tone };
  }
  const delta = effects(m).find(([h]) => h.id === (holdingId ?? m.holding!.id))?.[1] ?? 0;
  return { text: signed(delta), tone };
}

/** A movement's line in a list: what happened (and to which holding, unless the list is that holding's), and the details. */
export function describe(m: Movement, holdingId?: string): { title: string; details: string[] } {
  const label = KIND_LABEL[m.kind];
  const from = m.holding!;
  const details: string[] = [];
  let title: string;
  if (m.kind === 'TRANSFER') {
    const to = m.toHolding!;
    if (holdingId === from.id) {
      title = `${label} to ${nameOf(to)}`;
      details.push(to.platform);
    } else if (holdingId === to.id) {
      title = `${label} from ${nameOf(from)}`;
      details.push(from.platform);
    } else if (from.name === to.name) {
      // Same name on two platforms: the platforms tell them apart.
      title = `${label} · ${nameOf(from)} (${from.platform}) → ${nameOf(to)} (${to.platform})`;
    } else {
      title = `${label} · ${nameOf(from)} → ${nameOf(to)}`;
      details.push(from.platform === to.platform ? from.platform : `${from.platform} → ${to.platform}`);
    }
    if (m.feeUsd) details.push(`Fee ${formatUsd(m.feeUsd)}`);
  } else {
    title = holdingId ? label : `${label} · ${nameOf(from)}`;
    if (!holdingId) details.push(from.platform);
  }
  if (m.previousValueUsd !== null && m.newValueUsd !== null) {
    details.push(`${formatUsd(m.previousValueUsd)} → ${formatUsd(m.newValueUsd)}`);
  }
  return { title, details };
}

/** What undoing a movement would do, for its confirmation: "Undoing it takes $50.00 off Bitcoin." */
export function undoSentence(m: Movement): string {
  const parts = effects(m)
    .filter(([, delta]) => delta !== 0)
    .map(([h, delta]) => (delta > 0 ? `takes ${formatUsd(delta)} off ${h.name}` : `puts ${formatUsd(-delta)} back on ${h.name}`));
  return parts.length ? `Undoing it ${parts.join(' and ')}.` : 'Undoing it changes no value.';
}

/** "Sep 28, 2026", in the user's time zone. */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Please pick a date';
  if (date > today(now)) return "The date can't be in the future";
  if (date < '1970-01-01') return "The date can't be before 1970";
  return undefined;
}
