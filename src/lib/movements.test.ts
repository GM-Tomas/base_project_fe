import { describe, expect, it } from 'vitest';
import type { Movement, MovementDebt, MovementHolding } from '@/types/wealth';
import {
  amountOf,
  dateProblem,
  debtEffect,
  describe as describeMovement,
  effects,
  nameOf,
  occurredAtFor,
  today,
  undoSentence,
} from './movements';

const h = (id: string, name: string, platform: string, exists = true): MovementHolding => ({ id, name, platform, assetClass: 'Cash', exists });
const SAVINGS = h('a', 'Savings', 'Santander');
const USD = h('b', 'USD cash', 'Balanz');

const m = (kind: Movement['kind'], over: Partial<Movement> = {}): Movement => ({
  id: 'm', kind, occurredAt: '2026-09-28T12:00:00Z', createdAt: '2026-09-28T12:00:00Z', amountUsd: 1_000, feeUsd: null,
  holding: SAVINGS, toHolding: null, debt: null, previousValueUsd: null, newValueUsd: null, note: null, revertible: true, ...over,
});
const transfer = (over: Partial<Movement> = {}) => m('TRANSFER', { toHolding: USD, feeUsd: 2, ...over });
const VISA: MovementDebt = { id: 'd', name: 'Visa', lender: 'Galicia', exists: true };
const onDebt = (kind: Movement['kind'], over: Partial<Movement> = {}) => m(kind, { holding: null, debt: VISA, amountUsd: 300, ...over });

describe('movements', () => {
  it('knows what each kind did to holding values', () => {
    expect(effects(m('OPENING'))).toEqual([[SAVINGS, 1_000]]);
    expect(effects(m('CLOSING'))).toEqual([[SAVINGS, -1_000]]);
    expect(effects(m('DEPOSIT'))).toEqual([[SAVINGS, 1_000]]);
    expect(effects(m('WITHDRAWAL'))).toEqual([[SAVINGS, -1_000]]);
    expect(effects(transfer())).toEqual([[SAVINGS, -1_000], [USD, 998]]);
    expect(effects(m('ADJUSTMENT', { amountUsd: 0.1, previousValueUsd: 0.3, newValueUsd: 0.2 }))).toEqual([[SAVINGS, -0.1]]);
  });

  it('describes a transfer from where it is seen', () => {
    expect(describeMovement(transfer())).toEqual({ title: 'Transfer · Savings → USD cash', details: ['Santander → Balanz', 'Fee $2.00'] });
    expect(describeMovement(transfer({ feeUsd: 0 }), { holdingId: 'a' })).toEqual({ title: 'Transfer to USD cash', details: ['Balanz'] });
    expect(describeMovement(transfer(), { holdingId: 'b' })).toEqual({ title: 'Transfer from Savings', details: ['Santander', 'Fee $2.00'] });
    // Within one platform, it's named once; same name on two, the platforms tell them apart.
    expect(describeMovement(transfer({ feeUsd: 0, toHolding: h('c', 'Emergency', 'Santander') })).details).toEqual(['Santander']);
    expect(describeMovement(transfer({ feeUsd: 0, toHolding: h('d', 'Savings', 'Balanz', false) }))).toEqual({
      title: 'Transfer · Savings (Santander) → Savings (deleted) (Balanz)',
      details: [],
    });
  });

  it('describes the rest, with the values before and after an edit', () => {
    expect(describeMovement(m('GAIN'))).toEqual({ title: 'Gain · Savings', details: ['Santander'] });
    expect(describeMovement(m('LOSS', { previousValueUsd: 1_500, newValueUsd: 500 }), { holdingId: 'a' })).toEqual({
      title: 'Loss',
      details: ['$1,500.00 → $500.00'],
    });
    expect(nameOf(h('x', 'Gone', 'P', false))).toBe('Gone (deleted)');
  });

  it('shows amounts signed for the holding in question, colored only for performance', () => {
    expect(amountOf(m('GAIN'))).toEqual({ text: '+$1,000.00', tone: 'positive' });
    expect(amountOf(m('LOSS'))).toEqual({ text: '−$1,000.00', tone: 'negative' });
    expect(amountOf(m('WITHDRAWAL'))).toEqual({ text: '−$1,000.00', tone: 'neutral' });
    expect(amountOf(m('OPENING'))).toEqual({ text: '$1,000.00', tone: 'neutral' });
    expect(amountOf(transfer())).toEqual({ text: '$1,000.00', tone: 'neutral' });
    expect(amountOf(transfer(), { holdingId: 'a' })).toEqual({ text: '−$1,000.00', tone: 'neutral' });
    expect(amountOf(transfer(), { holdingId: 'b' })).toEqual({ text: '+$998.00', tone: 'neutral' });
  });

  it('says what undoing would do', () => {
    expect(undoSentence(m('GAIN'))).toBe('Undoing it takes $1,000.00 off Savings.');
    expect(undoSentence(m('LOSS'))).toBe('Undoing it puts $1,000.00 back on Savings.');
    expect(undoSentence(transfer({ feeUsd: 1_000 }))).toBe('Undoing it puts $1,000.00 back on Savings.');
    expect(undoSentence(m('ADJUSTMENT', { amountUsd: 0, previousValueUsd: 5, newValueUsd: 5 }))).toBe('Undoing it changes no value.');
  });

  it('knows what a debt movement did to the debt and to the asset the money came from or went to', () => {
    expect(effects(onDebt('DEBT_PAYMENT'))).toEqual([]);
    expect(effects(onDebt('DEBT_PAYMENT', { holding: SAVINGS }))).toEqual([[SAVINGS, -300]]);
    expect(effects(onDebt('DEBT_CHARGE', { toHolding: USD }))).toEqual([[USD, 300]]);
    expect(effects(onDebt('DEBT_CHARGE'))).toEqual([]);
    expect(effects(onDebt('DEBT_INTEREST'))).toEqual([]);
    expect(effects(onDebt('OPENING'))).toEqual([]);
    expect(effects(onDebt('ADJUSTMENT', { previousValueUsd: 300, newValueUsd: 0 }))).toEqual([]);

    expect(debtEffect(m('GAIN'))).toBeNull();
    expect(debtEffect(onDebt('OPENING'))).toBe(300);
    expect(debtEffect(onDebt('CLOSING'))).toBe(-300);
    expect(debtEffect(onDebt('DEBT_PAYMENT'))).toBe(-300);
    expect(debtEffect(onDebt('DEBT_CHARGE'))).toBe(300);
    expect(debtEffect(onDebt('DEBT_INTEREST'))).toBe(300);
    expect(debtEffect(onDebt('ADJUSTMENT', { previousValueUsd: 1_000, newValueUsd: 1_250.5 }))).toBe(250.5);
    // A movement about a debt is never one of these.
    expect(debtEffect(onDebt('TRANSFER'))).toBeNull();
  });

  it('describes a debt movement from where it is seen', () => {
    expect(describeMovement(onDebt('DEBT_PAYMENT', { holding: SAVINGS }))).toEqual({ title: 'Payment · Visa', details: ['Galicia', 'from Savings'] });
    expect(describeMovement(onDebt('DEBT_PAYMENT', { holding: SAVINGS }), { debtId: 'd' })).toEqual({ title: 'Payment', details: ['from Savings'] });
    // In the asset's own activity, the debt is what tells it apart.
    expect(describeMovement(onDebt('DEBT_PAYMENT', { holding: SAVINGS }), { holdingId: 'a' })).toEqual({ title: 'Payment · Visa', details: ['Galicia'] });
    expect(describeMovement(onDebt('DEBT_CHARGE', { toHolding: USD, debt: { ...VISA, lender: null, exists: false } }))).toEqual({
      title: 'New charge · Visa (deleted)',
      details: ['into USD cash'],
    });
    expect(describeMovement(onDebt('ADJUSTMENT', { previousValueUsd: 1_300, newValueUsd: 1_000 }), { debtId: 'd' })).toEqual({
      title: 'Correction',
      details: ['$1,300.00 → $1,000.00'],
    });
  });

  it("shows a debt movement's amount as what it did to what's owed, or to the asset in question", () => {
    // Paying a debt down is good for the net worth; interest isn't; a new charge just moved money.
    expect(amountOf(onDebt('DEBT_PAYMENT'))).toEqual({ text: '−$300.00', tone: 'positive' });
    expect(amountOf(onDebt('DEBT_INTEREST'))).toEqual({ text: '+$300.00', tone: 'negative' });
    expect(amountOf(onDebt('DEBT_CHARGE'))).toEqual({ text: '+$300.00', tone: 'neutral' });
    expect(amountOf(onDebt('DEBT_PAYMENT', { holding: SAVINGS }), { holdingId: 'a' })).toEqual({ text: '−$300.00', tone: 'neutral' });
    expect(amountOf(onDebt('OPENING'), { debtId: 'd' })).toEqual({ text: '$300.00', tone: 'neutral' });
  });

  it('says what undoing a debt movement would do', () => {
    expect(undoSentence(onDebt('DEBT_PAYMENT', { holding: SAVINGS }))).toBe(
      'Undoing it puts $300.00 back on Savings and adds $300.00 back to what you owe on Visa.',
    );
    expect(undoSentence(onDebt('DEBT_INTEREST'))).toBe('Undoing it takes $300.00 off what you owe on Visa.');
  });

  it('sends no date for today, and checks the one picked', () => {
    const now = new Date(2026, 9, 5, 23, 30); // local time
    expect(today(now)).toBe('2026-10-05');
    expect(today(new Date(2026, 0, 2))).toBe('2026-01-02');
    expect(occurredAtFor('2026-10-05', now)).toBeUndefined();
    expect(occurredAtFor('2026-10-04', now)).toBe('2026-10-04');
    expect(dateProblem('2026-10-05', now)).toBeUndefined();
    expect(dateProblem('2026-10-06', now)).toBe("The date can't be in the future");
    expect(dateProblem('1969-12-31', now)).toBe("The date can't be before 1970");
    expect(dateProblem('', now)).toBe('Please pick a date');
  });
});
