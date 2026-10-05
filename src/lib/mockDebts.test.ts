import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { createMockApi } from './mockApi';

// The mock's debts (mockDebts.ts) and their movements, through the API surface the app calls: the same
// checks and messages as the API's handler and service tests (base_project_go).

const start = Date.parse('2026-10-04T10:00:00Z');

function demo() {
  let clock = start;
  const api = createMockApi(() => new Date(clock));
  const tick = (ms = 60_000) => (clock += ms);
  const debt = async (name: string) => (await api.getDebts()).find((d) => d.name === name)!;
  const holding = async (name: string) => (await api.getHoldings()).find((h) => h.name === name)!;
  return { api, tick, debt, holding };
}

describe('mock debts', () => {
  it('lists the demo debts, largest first, with when each is paid off', async () => {
    const { api } = demo();

    expect(await api.getDebts()).toEqual([
      expect.objectContaining({
        name: 'Car loan',
        lender: 'Banco Galicia',
        kind: 'LOAN',
        balanceUsd: 8_400,
        interestRatePct: 12,
        monthlyPaymentUsd: 350,
        dueDay: 5,
        notes: 'Fixed rate, 36 payments',
        payoff: { status: 'ON_TRACK', months: 28, payoffMonth: '2029-02', totalInterestUsd: 1_253.63 },
      }),
      expect.objectContaining({ name: 'Visa Gold', balanceUsd: 1_250, payoff: expect.objectContaining({ months: 5, payoffMonth: '2027-03' }) }),
    ]);
  });

  it('adds a debt with its OPENING, and fills in what is not sent', async () => {
    const { api, tick } = demo();
    tick();

    const visa = await api.createDebt({
      name: ' Visa ',
      lender: ' Banco  Galicia ',
      kind: 'CREDIT_CARD',
      balanceUsd: 1_250.404,
      interestRatePct: 65,
      monthlyPaymentUsd: 300,
      dueDay: 10,
      notes: '  ',
    });
    expect(visa).toMatchObject({
      name: 'Visa',
      lender: 'Banco Galicia',
      balanceUsd: 1_250.4,
      notes: null,
      createdAt: '2026-10-04T10:01:00.000Z',
      payoff: { status: 'ON_TRACK', months: 5, payoffMonth: '2027-03' },
    });
    const [opening] = (await api.getMovements({ debtId: visa.id })).items;
    expect(opening).toMatchObject({ kind: 'OPENING', amountUsd: 1_250.4, debt: { id: visa.id, name: 'Visa', lender: 'Banco Galicia', exists: true } });
    expect(opening.revertible).toBe(false);

    const mom = await api.createDebt({ name: 'Mom', balanceUsd: 5_000 });
    expect(mom).toMatchObject({
      kind: 'OTHER',
      lender: null,
      interestRatePct: null,
      monthlyPaymentUsd: null,
      dueDay: null,
      payoff: { status: 'NO_PAYMENT', months: null, payoffMonth: null, totalInterestUsd: null },
    });
    expect((await api.getDebts()).map((d) => d.name)).toEqual(['Car loan', 'Mom', 'Visa', 'Visa Gold']);
    expect((await api.getSummary()).debts).toEqual({ usd: 9_650 + 1_250.4 + 5_000, count: 4, monthlyPaymentUsd: 950 });
  });

  it("validates a new debt with the API handler's rules and messages", async () => {
    const { api } = demo();
    const fails = (input: object) => api.createDebt(input as never).catch((e) => e);

    const all = await fails({ name: ' ', kind: 'CARD', interestRatePct: 201, monthlyPaymentUsd: -1, dueDay: 0 });
    expect(all).toBeInstanceOf(ApiError);
    expect(all).toMatchObject({
      status: 400,
      message:
        'Name is required; kind must be one of CREDIT_CARD, LOAN, MORTGAGE, PERSONAL, OTHER; Balance is required; ' +
        'interestRatePct must be between 0 and 200; Monthly payment must not be negative; dueDay must be between 1 and 31',
    });
    expect((all as ApiError).errors?.map((e) => e.field)).toEqual(['name', 'kind', 'balanceUsd', 'interestRatePct', 'monthlyPaymentUsd', 'dueDay']);
    expect(await fails({ name: 'x', balanceUsd: -1 })).toMatchObject({ message: 'Balance must not be negative' });
    expect(await fails({ name: 'x', balanceUsd: 1e16 })).toMatchObject({ message: 'Balance is too large' });
    expect(await fails({ name: 'x', balanceUsd: 1, monthlyPaymentUsd: 1e16 })).toMatchObject({ message: 'Monthly payment is too large' });
    expect(await fails({ name: 'x', balanceUsd: 1, dueDay: 1.5 })).toMatchObject({ status: 400, message: 'Malformed JSON body' });
    expect(await fails({ name: 'x'.repeat(121), balanceUsd: 1 })).toMatchObject({ message: 'Debt name exceeds max length (121 > 120)' });
    expect(await fails({ name: 'x', lender: 'y'.repeat(121), balanceUsd: 1 })).toMatchObject({ message: 'Lender exceeds max length (121 > 120)' });
    expect(await fails({ name: 'x', balanceUsd: 1, notes: 'z'.repeat(501) })).toMatchObject({ message: 'Notes exceeds max length (501 > 500)' });
    expect(await api.getDebts()).toHaveLength(2);
  });

  it('keeps to 200 debts', async () => {
    const { api } = demo();
    for (let i = (await api.getDebts()).length; i < 200; i++) await api.createDebt({ name: `d${i}`, balanceUsd: 1 });

    await expect(api.createDebt({ name: 'one more', balanceUsd: 1 })).rejects.toMatchObject({
      status: 409,
      message: 'You can track up to 200 debts. Remove one to add another.',
    });
  });

  it('edits only what is sent; null clears a term; a new balance says what it was', async () => {
    const { api, tick, debt } = demo();
    const visa = await debt('Visa Gold');
    tick();

    const edited = await api.updateDebt(visa.id, {
      lender: null,
      interestRatePct: null,
      dueDay: 15,
      notes: '0% until March',
      balanceUsd: 950.4,
      balanceChangeReason: 'PAYMENT',
      occurredAt: '2026-08-10',
      note: 'August',
    });
    expect(edited).toMatchObject({
      lender: null,
      interestRatePct: null,
      dueDay: 15,
      notes: '0% until March',
      balanceUsd: 950.4,
      monthlyPaymentUsd: 300, // not sent: as it was
      updatedAt: '2026-10-04T10:01:00.000Z',
      payoff: { status: 'ON_TRACK', months: 4 },
    });
    const [payment] = (await api.getMovements({ debtId: visa.id, kinds: ['DEBT_PAYMENT'], from: '2026-08-10', to: '2026-08-10' })).items;
    expect(payment).toMatchObject({
      amountUsd: 299.6,
      previousValueUsd: 1_250,
      newValueUsd: 950.4,
      occurredAt: '2026-08-10T12:00:00.000Z',
      note: 'August',
      holding: null,
      revertible: true,
    });

    // Each reason, and a correction by default.
    await api.updateDebt(visa.id, { balanceUsd: 1_000, balanceChangeReason: 'CHARGE' });
    await api.updateDebt(visa.id, { balanceUsd: 1_010, balanceChangeReason: 'INTEREST' });
    await api.updateDebt(visa.id, { balanceUsd: 1_000 });
    const kinds = (await api.getMovements({ debtId: visa.id, limit: 3 })).items.map((m) => [m.kind, m.amountUsd]);
    expect(kinds).toEqual([
      ['ADJUSTMENT', 10],
      ['DEBT_INTEREST', 10],
      ['DEBT_CHARGE', 49.6],
    ]);

    // Nothing new: nothing written.
    tick();
    const same = await api.updateDebt(visa.id, { name: 'Visa Gold', balanceUsd: 1_000, kind: 'CREDIT_CARD' });
    expect(same.updatedAt).toBe('2026-10-04T10:01:00.000Z');
    expect((await api.getMovements({ debtId: visa.id })).items).toHaveLength(7);
  });

  it("validates an edit with the API's rules and messages, changing nothing", async () => {
    const { api, debt } = demo();
    const visa = await debt('Visa Gold');
    const fails = (patch: object, id = visa.id) => api.updateDebt(id, patch as never).catch((e) => e);

    expect(await fails({ dueDay: 1.5 })).toMatchObject({ status: 400, message: 'Malformed JSON body' });
    expect(
      await fails({ name: null, kind: null, balanceUsd: null, interestRatePct: -1, monthlyPaymentUsd: 1e16, dueDay: 32, occurredAt: 'soon' }),
    ).toMatchObject({
      status: 400,
      message:
        'Name is required; Kind is required; Balance is required; interestRatePct must be between 0 and 200; ' +
        'Monthly payment is too large; dueDay must be between 1 and 31; occurredAt must be a date (YYYY-MM-DD) or a date and time (RFC 3339)',
    });
    expect(await fails({ kind: 'card' })).toMatchObject({ message: 'kind must be one of CREDIT_CARD, LOAN, MORTGAGE, PERSONAL, OTHER' });
    expect(await fails({ balanceUsd: -5 })).toMatchObject({ message: 'Balance must not be negative' });
    expect(await fails({ balanceUsd: 5, balanceChangeReason: 'GIFT' })).toMatchObject({
      message: 'balanceChangeReason must be one of PAYMENT, CHARGE, INTEREST, CORRECTION (got "GIFT")',
    });
    expect(await fails({ balanceUsd: 5_000, balanceChangeReason: 'PAYMENT' })).toMatchObject({
      status: 400,
      message: 'A payment can only lower the balance',
    });
    expect(await fails({ balanceUsd: 5, balanceChangeReason: 'CHARGE' })).toMatchObject({ message: 'New charges and interest can only raise the balance' });
    expect(await fails({ balanceUsd: 5, balanceChangeReason: 'INTEREST' })).toMatchObject({ message: 'New charges and interest can only raise the balance' });
    expect(await fails({ balanceUsd: 5, occurredAt: '2027-01-01' })).toMatchObject({ message: "occurredAt can't be in the future or before 1970" });
    expect(await fails({ name: 'x' }, 'nope')).toMatchObject({ status: 404, message: 'Debt nope not found' });
    expect(await debt('Visa Gold')).toMatchObject({ balanceUsd: 1_250, lender: 'Santander' });
  });

  it('removes a debt with its CLOSING; its activity stays, marked as gone', async () => {
    const { api, debt } = demo();
    const visa = await debt('Visa Gold');

    await api.deleteDebt(visa.id);
    expect((await api.getDebts()).map((d) => d.name)).toEqual(['Car loan']);
    expect((await api.getSummary()).netWorth.usd).toBe(107_420 - 8_400);
    const items = (await api.getMovements({ debtId: visa.id })).items;
    expect(items[0]).toMatchObject({ kind: 'CLOSING', amountUsd: 1_250, debt: { name: 'Visa Gold', exists: false }, revertible: false });
    expect(items.every((m) => !m.revertible && !m.debt!.exists)).toBe(true);
    await expect(api.deleteDebt(visa.id)).rejects.toMatchObject({ status: 404, message: `Debt ${visa.id} not found` });
    await expect(api.updateDebt(visa.id, { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('records payments (from an asset, maybe), new charges (into one, maybe) and interest', async () => {
    const { api, tick, debt, holding } = demo();
    const visa = await debt('Visa Gold');
    const savings = await holding('Savings account');
    tick();

    const payment = await api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, fromHoldingId: savings.id, amountUsd: 300 });
    expect(payment).toMatchObject({
      kind: 'DEBT_PAYMENT',
      amountUsd: 300,
      feeUsd: null,
      debt: { id: visa.id, name: 'Visa Gold', lender: 'Santander', exists: true },
      holding: { id: savings.id, name: 'Savings account' },
      toHolding: null,
      revertible: true,
    });
    expect(await debt('Visa Gold')).toMatchObject({ balanceUsd: 950, updatedAt: '2026-10-04T10:01:00.000Z' });
    expect(await holding('Savings account')).toMatchObject({ valueUsd: 9_200 });

    const charge = await api.createMovement({ kind: 'DEBT_CHARGE', debtId: visa.id, toHoldingId: savings.id, amountUsd: 50 });
    expect(charge).toMatchObject({ holding: null, toHolding: { id: savings.id } });
    await api.createMovement({ kind: 'DEBT_CHARGE', debtId: visa.id, amountUsd: 100, note: 'Fuel' });
    await api.createMovement({ kind: 'DEBT_INTEREST', debtId: visa.id, amountUsd: 20.5 });
    expect((await debt('Visa Gold')).balanceUsd).toBe(1_120.5);
    expect((await holding('Savings account')).valueUsd).toBe(9_250);
    expect((await api.getSummary()).netWorth.usd).toBe(107_420 - 300 + 50 - (8_400 + 1_120.5));

    // Never more than what's left to pay, nor than the asset is worth; nothing changes.
    await expect(api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, amountUsd: 1_120.51 })).rejects.toMatchObject({
      status: 409,
      message: 'Visa Gold only has $1,120.50 left to pay.',
    });
    const fund = await holding('Emergency fund');
    await api.createMovement({ kind: 'WITHDRAWAL', holdingId: fund.id, amountUsd: 3_000 });
    await expect(api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, fromHoldingId: fund.id, amountUsd: 1_000 })).rejects.toMatchObject({
      status: 409,
      message: "Emergency fund is worth $200.00: you can't pay more than that.",
    });
    expect((await debt('Visa Gold')).balanceUsd).toBe(1_120.5);
    await api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, amountUsd: 1_120.5 });
    expect(await debt('Visa Gold')).toMatchObject({ balanceUsd: 0, payoff: { status: 'PAID_OFF' } });

    // What's missing or gone.
    const fails = (input: object) => api.createMovement(input as never).catch((e) => e);
    expect(await fails({ kind: 'DEBT_INTEREST', amountUsd: 1 })).toMatchObject({ status: 400, message: 'debtId is required' });
    expect(await fails({ kind: 'DEBT_INTEREST', debtId: 'nope', amountUsd: 1 })).toMatchObject({ status: 404, message: 'Debt nope not found' });
    expect(await fails({ kind: 'DEBT_PAYMENT', debtId: visa.id, fromHoldingId: 'gone', amountUsd: 1 })).toMatchObject({
      status: 404,
      message: 'Holding gone not found',
    });
  });

  it('undoes a debt movement, and refuses what would go below zero or is gone', async () => {
    const { api, debt, holding } = demo();
    const visa = await debt('Visa Gold');
    const savings = await holding('Savings account');

    const payment = await api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, fromHoldingId: savings.id, amountUsd: 250 });
    await api.deleteMovement(payment.id);
    expect((await debt('Visa Gold')).balanceUsd).toBe(1_250);
    expect((await holding('Savings account')).valueUsd).toBe(9_500);

    // The interest was paid off since.
    const interest = await api.createMovement({ kind: 'DEBT_INTEREST', debtId: visa.id, amountUsd: 50 });
    await api.createMovement({ kind: 'DEBT_PAYMENT', debtId: visa.id, amountUsd: 1_280 });
    await expect(api.deleteMovement(interest.id)).rejects.toMatchObject({
      status: 409,
      message: 'Visa Gold has $20.00 left to pay: undoing this would take it below zero.',
    });

    // A charge paid into an asset that was spent since.
    const fund = await holding('Emergency fund');
    const charge = await api.createMovement({ kind: 'DEBT_CHARGE', debtId: visa.id, toHoldingId: fund.id, amountUsd: 100 });
    await api.createMovement({ kind: 'WITHDRAWAL', holdingId: fund.id, amountUsd: 3_250 });
    await expect(api.deleteMovement(charge.id)).rejects.toMatchObject({
      status: 409,
      message: 'Emergency fund is worth $50.00: undoing this would take it below zero.',
    });

    // The debt is gone.
    await api.deleteDebt(visa.id);
    await expect(api.deleteMovement(interest.id)).rejects.toMatchObject({ status: 409, message: "Visa Gold was removed, so this can't be undone." });
  });

  it('keeps the net worth, snapshots and projection in step with the debts', async () => {
    const { api, debt } = demo();
    const car = await debt('Car loan');

    // Owing more than owned: the net worth goes below zero.
    await api.updateDebt(car.id, { balanceUsd: 200_000, balanceChangeReason: 'CHARGE' });
    const summary = await api.getSummary();
    expect(summary.netWorth.usd).toBe(107_420 - 201_250);
    expect(summary.byPlatform[0].pct).toBe(51.3); // shares are of what's owned
    const snapshot = await api.createSnapshot();
    expect(snapshot).toMatchObject({ totalValueUsd: -93_830, assetsUsd: 107_420, debtsUsd: 201_250 });

    // The car loan's payment no longer covers its interest: it grows, and so the net worth shrinks.
    const estimate = await api.getEstimate({ contribution: 0, yieldPct: 0, years: 1 });
    expect(estimate.series[1].debtBalanceUsd).toBeGreaterThan(200_000);
    expect(estimate.series[1].netWorthUsd).toBeLessThan(-93_830);
    expect((await debt('Car loan')).payoff.status).toBe('NEVER');
  });
});
