import { describe, expect, it } from 'vitest';
import { debtBalances, debtPayoff, MAX_PAYOFF_MONTHS, monthAfter } from './amortization';

// The same cases as the API's (base_project_go: domain/service/debt_payoff_test.go), so both pay a debt off
// in the same month.

const now = new Date('2026-10-05T15:00:00Z');
const debt = (balanceUsd: number, interestRatePct: number | null, monthlyPaymentUsd: number | null) => ({
  balanceUsd,
  interestRatePct,
  monthlyPaymentUsd,
});

describe('debtPayoff', () => {
  it('pays a debt off without interest', () => {
    // 300, 300, 300 and the last 100.
    expect(debtPayoff(debt(1_000, null, 300), now)).toEqual({ status: 'ON_TRACK', months: 4, payoffMonth: '2027-02', totalInterestUsd: 0 });
  });

  it('adds each month’s interest rounded to cents', () => {
    // 12% a year is 1% a month: 10.00, 7.10, 4.17 and 1.21 of interest.
    expect(debtPayoff(debt(1_000, 12, 300), now)).toMatchObject({ status: 'ON_TRACK', months: 4, totalInterestUsd: 22.48 });
  });

  it('says when it is paid off already, or has no payment', () => {
    const none = { months: null, payoffMonth: null, totalInterestUsd: null };
    expect(debtPayoff(debt(0, 50, 100), now)).toEqual({ status: 'PAID_OFF', ...none });
    expect(debtPayoff(debt(500, 50, null), now)).toEqual({ status: 'NO_PAYMENT', ...none });
    expect(debtPayoff(debt(500, null, 0), now)).toEqual({ status: 'NO_PAYMENT', ...none });
  });

  it('never pays off when the payment does not cover the interest, or takes over 50 years', () => {
    // The payment only covers the interest (2% a month on 10,000): the balance never goes down.
    expect(debtPayoff(debt(10_000, 24, 200), now)).toEqual({ status: 'NEVER', months: null, payoffMonth: null, totalInterestUsd: null });
    expect(debtPayoff(debt(10_000, 24, 150), now).status).toBe('NEVER');
    // A cent above the interest: paid off, but in far more than 50 years.
    expect(debtPayoff(debt(100_000, 12, 1_000.01), now).status).toBe('NEVER');
    // Just within the horizon.
    expect(debtPayoff(debt(600, null, 1), now)).toMatchObject({ status: 'ON_TRACK', months: MAX_PAYOFF_MONTHS });
    expect(debtPayoff(debt(600.01, null, 1), now).status).toBe('NEVER');
  });
});

describe('debtBalances', () => {
  it('amortizes month by month, never below zero', () => {
    expect(debtBalances(debt(1_000, 12, 300), 5)).toEqual([1_000, 710, 417.1, 121.27, 0, 0]);
  });

  it('stays as it is without a payment, and grows when the payment is below the interest', () => {
    expect(debtBalances(debt(500, 80, null), 2)).toEqual([500, 500, 500]);
    expect(debtBalances(debt(1_000, 24, 10), 2)).toEqual([1_000, 1_010, 1_020.2]);
  });

  it('never grows beyond the largest amount the API keeps', () => {
    expect(debtBalances(debt(1e15, 200, 1), 2)[2]).toBe(1e15);
  });
});

describe('monthAfter', () => {
  it('counts months from now’s month, in UTC', () => {
    const cases: [number, string][] = [
      [0, '2026-10'],
      [2, '2026-12'],
      [3, '2027-01'],
      [15, '2028-01'],
      [600, '2076-10'],
    ];
    for (const [months, month] of cases) expect(monthAfter(now, months)).toBe(month);
  });
});
