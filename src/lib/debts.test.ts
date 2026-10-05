import { describe, expect, it } from 'vitest';
import type { Debt, DebtPayoff } from '@/types/wealth';
import {
  averageRate,
  debtFreeOutlook,
  debtFreeSummary,
  dueText,
  formatMonth,
  formatRate,
  ordinal,
  payoffDetail,
  payoffText,
} from './debts';

const none = { months: null, payoffMonth: null, totalInterestUsd: null };
const onTrack = (months: number, payoffMonth: string, totalInterestUsd = 0): DebtPayoff => ({
  status: 'ON_TRACK',
  months,
  payoffMonth,
  totalInterestUsd,
});

function debt(name: string, balanceUsd: number, interestRatePct: number | null, payoff: DebtPayoff): Debt {
  return {
    id: name,
    name,
    lender: null,
    kind: 'OTHER',
    balanceUsd,
    interestRatePct,
    monthlyPaymentUsd: null,
    dueDay: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    payoff,
  };
}

describe('debts, in words', () => {
  it('says which day a debt is due', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ]);
    expect(dueText(10)).toBe('Due on the 10th');
    expect(dueText(null)).toBeNull();
  });

  it('writes months and rates', () => {
    expect(formatMonth('2027-12')).toBe('Dec 2027');
    expect(formatRate(65)).toBe('65%');
    expect(formatRate(12.5)).toBe('12.5%');
  });

  it('says when a debt is paid off', () => {
    expect(payoffText(onTrack(14, '2027-12'))).toEqual({ text: 'Paid off in 14 months · Dec 2027', tone: 'neutral' });
    expect(payoffText(onTrack(1, '2026-11')).text).toBe('Paid off in 1 month · Nov 2026');
    expect(payoffText({ status: 'NEVER', ...none })).toEqual({ text: 'Never at this payment', tone: 'negative' });
    expect(payoffText({ status: 'NO_PAYMENT', ...none }).text).toBe("Add a monthly payment to see when it's paid off");
    expect(payoffText({ status: 'PAID_OFF', ...none })).toEqual({ text: 'Paid off', tone: 'positive' });

    expect(payoffDetail(onTrack(14, '2027-12', 140.2))).toBe('$140.20 in interest until then');
    expect(payoffDetail(onTrack(3, '2027-01'))).toBe('No interest until then');
    expect(payoffDetail({ status: 'NEVER', ...none })).toMatch(/doesn't cover the interest/);
    expect(payoffDetail({ status: 'PAID_OFF', ...none })).toBeNull();
  });

  it('averages the rates weighted by what is left to pay', () => {
    const debts = [
      debt('Card', 1_000, 60, onTrack(4, '2027-02')),
      debt('Loan', 3_000, 12, onTrack(10, '2027-08')),
      debt('Friend', 5_000, null, { status: 'NO_PAYMENT', ...none }),
      debt('Old', 0, 99, { status: 'PAID_OFF', ...none }),
    ];
    expect(averageRate(debts)).toBe(24);
    expect(averageRate([debts[2], debts[3]])).toBeNull();
  });

  it('says when everything is paid off, or why that isn’t known', () => {
    const card = debt('Card', 1_000, 60, onTrack(4, '2027-02'));
    const loan = debt('Loan', 3_000, 12, onTrack(29, '2029-03'));
    const friend = debt('Friend', 500, null, { status: 'NO_PAYMENT', ...none });
    const stuck = debt('Stuck', 9_000, 90, { status: 'NEVER', ...none });
    const done = debt('Done', 0, null, { status: 'PAID_OFF', ...none });

    expect(debtFreeSummary(debtFreeOutlook([card, loan, done]))).toEqual({
      label: 'Debt-free by',
      value: 'Mar 2029',
      detail: 'If you keep up the monthly payments',
      tone: 'neutral',
    });
    expect(debtFreeSummary(debtFreeOutlook([done]))).toMatchObject({ value: 'Now', detail: 'Nothing left to pay', tone: 'positive' });
    // What never gets paid off comes first.
    expect(debtFreeSummary(debtFreeOutlook([card, friend, stuck]))).toMatchObject({
      value: 'Never',
      detail: 'Stuck never gets paid off at its payment',
      tone: 'negative',
    });
    expect(debtFreeSummary(debtFreeOutlook([stuck, { ...stuck, id: 'Stuck 2' }])).detail).toBe('2 debts never get paid off at their payments');
    expect(debtFreeSummary(debtFreeOutlook([card, friend]))).toMatchObject({
      value: 'Not known yet',
      detail: 'Add a monthly payment to Friend to see when',
    });
    expect(debtFreeSummary(debtFreeOutlook([friend, { ...friend, id: 'Friend 2' }])).detail).toBe('Add a monthly payment to 2 debts to see when');
  });
});
