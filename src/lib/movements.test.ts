import { describe, expect, it } from 'vitest';
import type { Movement, MovementHolding } from '@/types/wealth';
import { amountOf, dateProblem, describe as describeMovement, effects, nameOf, occurredAtFor, today, undoSentence } from './movements';

const h = (id: string, name: string, platform: string, exists = true): MovementHolding => ({ id, name, platform, assetClass: 'Cash', exists });
const SAVINGS = h('a', 'Savings', 'Santander');
const USD = h('b', 'USD cash', 'Balanz');

const m = (kind: Movement['kind'], over: Partial<Movement> = {}): Movement => ({
  id: 'm', kind, occurredAt: '2026-09-28T12:00:00Z', createdAt: '2026-09-28T12:00:00Z', amountUsd: 1_000, feeUsd: null,
  holding: SAVINGS, toHolding: null, previousValueUsd: null, newValueUsd: null, note: null, revertible: true, ...over,
});
const transfer = (over: Partial<Movement> = {}) => m('TRANSFER', { toHolding: USD, feeUsd: 2, ...over });

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
    expect(describeMovement(transfer({ feeUsd: 0 }), 'a')).toEqual({ title: 'Transfer to USD cash', details: ['Balanz'] });
    expect(describeMovement(transfer(), 'b')).toEqual({ title: 'Transfer from Savings', details: ['Santander', 'Fee $2.00'] });
    // Within one platform, it's named once; same name on two, the platforms tell them apart.
    expect(describeMovement(transfer({ feeUsd: 0, toHolding: h('c', 'Emergency', 'Santander') })).details).toEqual(['Santander']);
    expect(describeMovement(transfer({ feeUsd: 0, toHolding: h('d', 'Savings', 'Balanz', false) }))).toEqual({
      title: 'Transfer · Savings (Santander) → Savings (deleted) (Balanz)',
      details: [],
    });
  });

  it('describes the rest, with the values before and after an edit', () => {
    expect(describeMovement(m('GAIN'))).toEqual({ title: 'Gain · Savings', details: ['Santander'] });
    expect(describeMovement(m('LOSS', { previousValueUsd: 1_500, newValueUsd: 500 }), 'a')).toEqual({
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
    expect(amountOf(transfer(), 'a')).toEqual({ text: '−$1,000.00', tone: 'neutral' });
    expect(amountOf(transfer(), 'b')).toEqual({ text: '+$998.00', tone: 'neutral' });
  });

  it('says what undoing would do', () => {
    expect(undoSentence(m('GAIN'))).toBe('Undoing it takes $1,000.00 off Savings.');
    expect(undoSentence(m('LOSS'))).toBe('Undoing it puts $1,000.00 back on Savings.');
    expect(undoSentence(transfer({ feeUsd: 1_000 }))).toBe('Undoing it puts $1,000.00 back on Savings.');
    expect(undoSentence(m('ADJUSTMENT', { amountUsd: 0, previousValueUsd: 5, newValueUsd: 5 }))).toBe('Undoing it changes no value.');
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
