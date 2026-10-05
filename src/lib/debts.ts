import type { Debt, DebtKind, DebtPayoff } from '@/types/wealth';
import { formatUsd } from './money';

// How debts read: what each kind is called, when one is due and paid off, and what they add up to.

export const DEBT_KIND_LABEL: Record<DebtKind, string> = {
  CREDIT_CARD: 'Credit card',
  LOAN: 'Loan',
  MORTGAGE: 'Mortgage',
  PERSONAL: 'Personal',
  OTHER: 'Other',
};

export const DEBT_KINDS = Object.keys(DEBT_KIND_LABEL) as DebtKind[];

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** "Due on the 10th", or nothing when there's no due day. */
export const dueText = (dueDay: number | null) => (dueDay ? `Due on the ${ordinal(dueDay)}` : null);

/** "Dec 2027", for a YYYY-MM. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** "65%", "12.5%". */
export const formatRate = (pct: number) => `${pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

export type PayoffTone = 'positive' | 'negative' | 'neutral';

/** When a debt is paid off at its monthly payment, in a few words. */
export function payoffText(payoff: DebtPayoff): { text: string; tone: PayoffTone } {
  switch (payoff.status) {
    case 'PAID_OFF':
      return { text: 'Paid off', tone: 'positive' };
    case 'ON_TRACK': {
      const months = payoff.months!;
      return { text: `Paid off in ${months} ${months === 1 ? 'month' : 'months'} · ${formatMonth(payoff.payoffMonth!)}`, tone: 'neutral' };
    }
    case 'NEVER':
      return { text: 'Never at this payment', tone: 'negative' };
    case 'NO_PAYMENT':
      return { text: "Add a monthly payment to see when it's paid off", tone: 'neutral' };
  }
}

/** A line on what the payoff costs or why it doesn't come: for a debt's own panel. */
export function payoffDetail(payoff: DebtPayoff): string | null {
  if (payoff.status === 'ON_TRACK') {
    return payoff.totalInterestUsd ? `${formatUsd(payoff.totalInterestUsd)} in interest until then` : 'No interest until then';
  }
  if (payoff.status === 'NEVER') {
    return "The monthly payment doesn't cover the interest, so the balance never goes down (or it takes over 50 years).";
  }
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
  switch (outlook.status) {
    case 'CLEAR':
      return { label: 'Debt-free', value: 'Now', detail: 'Nothing left to pay', tone: 'positive' };
    case 'BY':
      return { label: 'Debt-free by', value: formatMonth(outlook.month), detail: 'If you keep up the monthly payments', tone: 'neutral' };
    case 'NEVER':
      return {
        label: 'Debt-free',
        value: 'Never',
        detail:
          outlook.debts.length === 1
            ? `${outlook.debts[0].name} never gets paid off at its payment`
            : `${outlook.debts.length} debts never get paid off at their payments`,
        tone: 'negative',
      };
    case 'NO_PAYMENT':
      return {
        label: 'Debt-free',
        value: 'Not known yet',
        detail:
          outlook.debts.length === 1
            ? `Add a monthly payment to ${outlook.debts[0].name} to see when`
            : `Add a monthly payment to ${outlook.debts.length} debts to see when`,
        tone: 'neutral',
      };
  }
}
