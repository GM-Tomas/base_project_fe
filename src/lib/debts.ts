import type { Debt, DebtKind, DebtPayoff } from '@/types/wealth';
import { formatUsd } from './money';
import { formatNumber } from './calculations';
import { intlLocale, messages } from './i18n';

// How debts read: what each kind is called, when one is due and paid off, and what they add up to.

export { ordinal } from '@/i18n/en';

export const DEBT_KINDS: DebtKind[] = ['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'PERSONAL', 'OTHER'];

/** "Credit card", in the app's language. */
export const debtKindLabel = (kind: DebtKind) => messages().debts.kinds[kind];

/** "Due on the 10th", or nothing when there's no due day. */
export const dueText = (dueDay: number | null) => (dueDay ? messages().debts.dueOn(dueDay) : null);

/** "Dec 2027", for a YYYY-MM. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(intlLocale(), { month: 'short', year: 'numeric' });
}

/** "65%", "12.5%". */
export const formatRate = (pct: number) => `${formatNumber(pct, 2)}%`;

export type PayoffTone = 'positive' | 'negative' | 'neutral';

/** When a debt is paid off at its monthly payment, in a few words. */
export function payoffText(payoff: DebtPayoff): { text: string; tone: PayoffTone } {
  const t = messages().debts;
  switch (payoff.status) {
    case 'PAID_OFF':
      return { text: t.paidOff, tone: 'positive' };
    case 'ON_TRACK':
      return { text: t.paidOffIn(payoff.months!, formatMonth(payoff.payoffMonth!)), tone: 'neutral' };
    case 'NEVER':
      return { text: t.neverAtPayment, tone: 'negative' };
    case 'NO_PAYMENT':
      return { text: t.addPayment, tone: 'neutral' };
  }
}

/** A line on what the payoff costs or why it doesn't come: for a debt's own panel. */
export function payoffDetail(payoff: DebtPayoff): string | null {
  const t = messages().debts;
  if (payoff.status === 'ON_TRACK') return payoff.totalInterestUsd ? t.interestUntil(formatUsd(payoff.totalInterestUsd)) : t.noInterest;
  if (payoff.status === 'NEVER') return t.neverDetail;
  return null;
}

/**
 * The average annual rate, weighted by what's left to pay on each debt: only the debts that have both a rate
 * and a balance count. Null when none does.
 */
export function averageRate(debts: Debt[]): number | null {
  let weighted = 0;
  let total = 0;
  for (const d of debts) {
    if (d.interestRatePct === null || d.balanceUsd <= 0) continue;
    weighted += d.interestRatePct * d.balanceUsd;
    total += d.balanceUsd;
  }
  return total > 0 ? weighted / total : null;
}

/** When all of it is paid off, if it is: the last payoff, or what keeps that from being known. */
export type DebtFreeOutlook =
  | { status: 'CLEAR' }
  | { status: 'BY'; month: string }
  | { status: 'NEVER'; debts: Debt[] }
  | { status: 'NO_PAYMENT'; debts: Debt[] };

export function debtFreeOutlook(debts: Debt[]): DebtFreeOutlook {
  const never = debts.filter((d) => d.payoff.status === 'NEVER');
  if (never.length) return { status: 'NEVER', debts: never };
  const noPayment = debts.filter((d) => d.payoff.status === 'NO_PAYMENT');
  if (noPayment.length) return { status: 'NO_PAYMENT', debts: noPayment };
  const months = debts.flatMap((d) => (d.payoff.payoffMonth ? [d.payoff.payoffMonth] : []));
  // YYYY-MM sorts as text.
  return months.length ? { status: 'BY', month: months.sort().at(-1)! } : { status: 'CLEAR' };
}

/** The Debts header's last figure: when it's all paid off, or why that isn't known. */
export function debtFreeSummary(outlook: DebtFreeOutlook): { label: string; value: string; detail: string; tone: PayoffTone } {
  const t = messages().debts;
  switch (outlook.status) {
    case 'CLEAR':
      return { label: t.debtFree, value: t.now, detail: t.nothingLeft, tone: 'positive' };
    case 'BY':
      return { label: t.debtFreeBy, value: formatMonth(outlook.month), detail: t.keepUp, tone: 'neutral' };
    case 'NEVER':
      return {
        label: t.debtFree,
        value: t.never,
        detail: outlook.debts.length === 1 ? t.neverOne(outlook.debts[0].name) : t.neverMany(outlook.debts.length),
        tone: 'negative',
      };
    case 'NO_PAYMENT':
      return {
        label: t.debtFree,
        value: t.notKnown,
        detail: outlook.debts.length === 1 ? t.addPaymentOne(outlook.debts[0].name) : t.addPaymentMany(outlook.debts.length),
        tone: 'neutral',
      };
  }
}
