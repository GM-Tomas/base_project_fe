import type { Debt, DebtPayoff } from '@/types/wealth';

// How the API (base_project_go: domain/service/debt_payoff.go) pays a debt off, for the mock: month by
// month, the month's interest (rounded to cents, as lenders charge it) is added and the payment taken off,
// for at most 50 years. Amounts are worked in whole cents, so no float error builds up.

export const MAX_PAYOFF_MONTHS = 600;
const MAX_BALANCE_CENTS = 1e17; // the largest amount the API keeps, 1e15 dollars

type Terms = Pick<Debt, 'balanceUsd' | 'interestRatePct' | 'monthlyPaymentUsd'>;

const toCents = (usd: number) => Math.round(usd * 100);

// One month: [the balance after it, the interest charged], in cents.
function amortize(balance: number, ratePct: number, payment: number): [number, number] {
  const interest = Math.round((balance * ratePct) / 1200);
  return [balance + interest - payment, interest];
}

/** "YYYY-MM", months after now's month (UTC). */
export function monthAfter(now: Date, months: number): string {
  const total = now.getUTCMonth() + months;
  return `${now.getUTCFullYear() + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** When the debt is paid off at its monthly payment, as the API computes it. */
export function debtPayoff(d: Terms, now: Date): DebtPayoff {
  const none = { months: null, payoffMonth: null, totalInterestUsd: null };
  let balance = toCents(d.balanceUsd);
  if (balance === 0) return { status: 'PAID_OFF', ...none };
  const payment = toCents(d.monthlyPaymentUsd ?? 0);
  if (payment === 0) return { status: 'NO_PAYMENT', ...none };
  const rate = d.interestRatePct ?? 0;
  let total = 0;
  for (let month = 1; month <= MAX_PAYOFF_MONTHS; month++) {
    const [next, interest] = amortize(balance, rate, payment);
    if (next >= balance) break; // the payment doesn't cover the interest: it never goes down
    balance = next;
    total += interest;
    if (balance <= 0) {
      return { status: 'ON_TRACK', months: month, payoffMonth: monthAfter(now, month), totalInterestUsd: total / 100 };
    }
  }
  return { status: 'NEVER', ...none };
}

/**
 * What's left to pay now and after each of the next months (months + 1 values, in dollars): amortized like
 * debtPayoff, never below zero. Without a payment it stays as it is; with one below the interest it grows.
 */
export function debtBalances(d: Terms, months: number): number[] {
  let balance = toCents(d.balanceUsd);
  const payment = toCents(d.monthlyPaymentUsd ?? 0);
  const rate = d.interestRatePct ?? 0;
  const balances = [balance / 100];
  for (let m = 1; m <= months; m++) {
    if (payment > 0 && balance > 0) {
      balance = Math.min(Math.max(amortize(balance, rate, payment)[0], 0), MAX_BALANCE_CENTS);
    }
    balances.push(balance / 100);
  }
  return balances;
}
