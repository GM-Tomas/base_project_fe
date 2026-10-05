import { describe, expect, it } from 'vitest';
import type { Movement } from '@/types/wealth';
import { createMockApi } from './mockApi';
import { debtEffect, effects } from './movements';

// The mock's activity log (mockLedger.ts), through the API surface the app calls.

const start = Date.parse('2026-10-04T10:00:00Z');

function demo() {
  let clock = start;
  const api = createMockApi(() => new Date(clock));
  const tick = (ms = 60_000) => (clock += ms);
  const holding = async (name: string) => (await api.getHoldings()).find((h) => h.name === name)!;
  const value = async (name: string) => (await holding(name))?.valueUsd;
  return { api, tick, holding, value };
}

// What a movement did to each holding's and debt's value, from what the API returns.
function deltas(m: Movement): [string, number][] {
  const changes: [string, number][] = effects(m).map(([h, delta]) => [h.id, delta]);
  const owed = debtEffect(m);
  if (owed !== null) changes.push([m.debt!.id, owed]);
  return changes;
}

describe('mock activity log', () => {
  it("seeds an activity that adds up to each demo holding's value, newest first", async () => {
    const { api } = demo();

    const { items, nextCursor } = await api.getMovements();
    expect(nextCursor).toBeNull();
    expect(items.map((m) => [m.kind, m.debt?.name, m.holding?.name].filter(Boolean).join(' '))).toEqual([
      'DEBT_PAYMENT Car loan',
      'TRANSFER Savings account',
      'GAIN Bitcoin',
      'DEBT_PAYMENT Visa Gold Savings account',
      'DEPOSIT Savings account',
      'DEBT_CHARGE Visa Gold',
      'LOSS Apple (AAPL)',
      'GAIN US Treasury 2027',
      'DEBT_PAYMENT Car loan',
      'GAIN Vanguard S&P 500 ETF (VOO)',
      'ADJUSTMENT Ethereum',
      'OPENING Car loan',
      'OPENING Visa Gold',
      'OPENING Emergency fund',
      'OPENING Savings account',
      'OPENING US Treasury 2027',
      'OPENING Ethereum',
      'OPENING Bitcoin',
      'OPENING Apple (AAPL)',
      'OPENING Vanguard S&P 500 ETF (VOO)',
    ]);
    expect(items[1]).toMatchObject({
      occurredAt: '2026-09-28T10:00:00.000Z',
      amountUsd: 1_200,
      feeUsd: 0,
      toHolding: { name: 'Emergency fund', platform: 'Mercado Pago', exists: true },
      revertible: true,
    });
    expect(items.find((m) => m.kind === 'ADJUSTMENT')).toMatchObject({ previousValueUsd: 6_200, newValueUsd: 6_120, note: 'Fixed a typo' });
    expect(items.filter((m) => m.kind === 'OPENING').every((m) => !m.revertible)).toBe(true);

    const sums = new Map<string, number>();
    for (const m of items) for (const [id, delta] of deltas(m)) sums.set(id, (sums.get(id) ?? 0) + delta);
    for (const h of await api.getHoldings()) expect(sums.get(h.id)).toBeCloseTo(h.valueUsd, 2);
    for (const d of await api.getDebts()) expect(sums.get(d.id)).toBeCloseTo(d.balanceUsd, 2);
    expect(items.find((m) => m.kind === 'DEBT_CHARGE')).toMatchObject({
      debt: { name: 'Visa Gold', lender: 'Santander', exists: true },
      holding: null,
      toHolding: null,
      note: 'Groceries and fuel',
      revertible: true,
    });
  });

  it('records gains, losses, deposits and withdrawals on a holding', async () => {
    const { api, tick, holding, value } = demo();
    const btc = await holding('Bitcoin');
    tick();

    const gain = await api.createMovement({ kind: 'GAIN', holdingId: btc.id, amountUsd: 49.999, note: '  Staking  ' });
    expect(gain).toMatchObject({
      kind: 'GAIN',
      amountUsd: 50,
      feeUsd: null,
      occurredAt: '2026-10-04T10:01:00.000Z',
      createdAt: '2026-10-04T10:01:00.000Z',
      holding: { id: btc.id, name: 'Bitcoin', platform: 'Binance', assetClass: 'Crypto', exists: true },
      toHolding: null,
      note: 'Staking',
      revertible: true,
    });
    expect(await holding('Bitcoin')).toMatchObject({ valueUsd: 18_500, updatedAt: '2026-10-04T10:01:00.000Z' });

    await api.createMovement({ kind: 'LOSS', holdingId: btc.id, amountUsd: 500 });
    await api.createMovement({ kind: 'WITHDRAWAL', holdingId: btc.id, amountUsd: 1_000 });
    await api.createMovement({ kind: 'DEPOSIT', holdingId: btc.id, amountUsd: 0.5, occurredAt: '2026-10-01' });
    expect(await value('Bitcoin')).toBe(17_000.5);

    // A date is noon UTC; the activity sorts by when things happened.
    const [latest] = (await api.getMovements({ holdingId: btc.id, kinds: ['DEPOSIT'] })).items;
    expect(latest.occurredAt).toBe('2026-10-01T12:00:00.000Z');

    // Never below zero, with the API's messages.
    await expect(api.createMovement({ kind: 'LOSS', holdingId: btc.id, amountUsd: 17_000.51 })).rejects.toMatchObject({
      status: 409,
      message: "Bitcoin is worth $17,000.50: a loss can't be larger than that.",
    });
    await expect(api.createMovement({ kind: 'WITHDRAWAL', holdingId: btc.id, amountUsd: 20_000 })).rejects.toMatchObject({
      message: "Bitcoin is worth $17,000.50: you can't withdraw more than that.",
    });
    await api.createMovement({ kind: 'WITHDRAWAL', holdingId: btc.id, amountUsd: 17_000.5 });
    expect(await value('Bitcoin')).toBe(0);
  });

  it("validates a movement with the API's rules and messages", async () => {
    const { api, holding } = demo();
    const { id } = await holding('Bitcoin');
    const fails = (input: object) => api.createMovement(input as never).catch((e) => e);

    expect(await fails({ kind: 'OPENING', holdingId: id, amountUsd: 1 })).toMatchObject({
      status: 400,
      message: 'kind must be one of GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, DEBT_PAYMENT, DEBT_CHARGE, DEBT_INTEREST',
      errors: [{ field: 'kind', message: 'kind must be one of GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, DEBT_PAYMENT, DEBT_CHARGE, DEBT_INTEREST' }],
    });
    expect(await fails({ kind: 'GAIN', amountUsd: 1 })).toMatchObject({ status: 400, message: 'holdingId is required' });
    expect(await fails({ kind: 'GAIN', holdingId: 'nope', amountUsd: 1 })).toMatchObject({ status: 404, message: 'Holding nope not found' });
    expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: 0.004 })).toMatchObject({ message: 'amount must be greater than 0' });
    expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: Number.NaN })).toMatchObject({ message: 'amount must be greater than 0' });
    expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: -5 })).toMatchObject({ message: 'money must not be negative: -5' });
    expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: 1e15 + 1 })).toMatchObject({ message: 'Amount is too large' });
    expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: 1, note: 'x'.repeat(201) })).toMatchObject({
      message: 'Note exceeds max length (201 > 200)',
    });
    for (const occurredAt of ['yesterday', '2026-02-30', '2026-10-04T10:00']) {
      expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: 1, occurredAt })).toMatchObject({
        status: 400,
        message: 'occurredAt must be a date (YYYY-MM-DD) or a date and time (RFC 3339)',
      });
    }
    for (const occurredAt of ['2026-10-06', '1969-12-31T23:59:59Z']) {
      expect(await fails({ kind: 'GAIN', holdingId: id, amountUsd: 1, occurredAt })).toMatchObject({
        message: "occurredAt can't be in the future or before 1970",
      });
    }
    // A day of slack for time zones ahead of UTC; an instant keeps its time.
    await expect(api.createMovement({ kind: 'GAIN', holdingId: id, amountUsd: 1, occurredAt: '2026-10-04' })).resolves.toMatchObject({
      occurredAt: '2026-10-04T12:00:00.000Z',
    });
    await expect(
      api.createMovement({ kind: 'GAIN', holdingId: id, amountUsd: 1, occurredAt: '2026-10-05T09:59:00+00:00' }),
    ).resolves.toBeTruthy();
    await expect(
      api.createMovement({ kind: 'GAIN', holdingId: id, amountUsd: 1, occurredAt: '2026-10-04T08:30:00-03:00' }),
    ).resolves.toMatchObject({ occurredAt: '2026-10-04T11:30:00.000Z' });
  });

  it('transfers between holdings, to an existing one or to a new one, with a fee', async () => {
    const { api, tick, holding, value } = demo();
    const savings = await holding('Savings account');
    const fund = await holding('Emergency fund');
    tick();

    const transfer = await api.createMovement({ kind: 'TRANSFER', fromHoldingId: savings.id, toHoldingId: fund.id, amountUsd: 1_000, feeUsd: 2.5 });
    expect(transfer).toMatchObject({
      kind: 'TRANSFER',
      amountUsd: 1_000,
      feeUsd: 2.5,
      holding: { id: savings.id, name: 'Savings account', exists: true },
      toHolding: { id: fund.id, name: 'Emergency fund', exists: true },
    });
    expect(await value('Savings account')).toBe(8_500);
    expect(await value('Emergency fund')).toBe(4_197.5);

    // A new destination: added like any holding (the account's spelling of the platform wins), opened by
    // the transfer itself.
    const opened = await api.createMovement({
      kind: 'TRANSFER',
      fromHoldingId: savings.id,
      toNewHolding: { name: ' USD cash ', assetClass: 'Cash', platform: 'balanz' },
      amountUsd: 500,
    });
    const usd = await holding('USD cash');
    expect(usd).toMatchObject({ platform: 'Balanz', assetClass: 'Cash', valueUsd: 500 });
    expect(opened).toMatchObject({ feeUsd: 0, toHolding: { id: usd.id, name: 'USD cash', platform: 'Balanz' } });
    expect((await api.getMovements({ holdingId: usd.id })).items.map((m) => m.kind)).toEqual(['TRANSFER']);

    await expect(
      api.createMovement({ kind: 'TRANSFER', fromHoldingId: usd.id, toHoldingId: savings.id, amountUsd: 500.01 }),
    ).rejects.toMatchObject({ status: 409, message: "USD cash is worth $500.00: you can't transfer more than that." });
  });

  it("rejects a transfer the API would reject, changing nothing", async () => {
    const { api, holding } = demo();
    const savings = await holding('Savings account');
    const fund = await holding('Emergency fund');
    const fails = (input: object) => api.createMovement({ kind: 'TRANSFER', amountUsd: 100, ...input } as never).catch((e) => e);

    // Every problem with the holdings at once.
    const both = await fails({ toHoldingId: fund.id, toNewHolding: { name: 'x', assetClass: 'Cash', platform: 'y' } });
    expect(both).toMatchObject({ status: 400, message: 'fromHoldingId is required; Send either toHoldingId or toNewHolding' });
    expect(both.errors.map((e: { field: string }) => e.field)).toEqual(['fromHoldingId', 'toHoldingId']);
    expect(await fails({ fromHoldingId: savings.id, toHoldingId: savings.id })).toMatchObject({ message: 'Pick a different destination' });
    expect(await fails({ fromHoldingId: savings.id })).toMatchObject({ message: 'Send either toHoldingId or toNewHolding' });
    expect(await fails({ fromHoldingId: savings.id, toHoldingId: fund.id, feeUsd: 100.01 })).toMatchObject({
      message: "fee can't be larger than the amount",
    });
    expect(await fails({ fromHoldingId: savings.id, toHoldingId: fund.id, feeUsd: -1 })).toMatchObject({ message: 'money must not be negative: -1' });
    expect(await fails({ fromHoldingId: savings.id, toHoldingId: fund.id, feeUsd: 1e16 })).toMatchObject({ message: 'Amount is too large' });
    // A new destination is checked as a new holding first, before the holdings are looked up.
    expect(await fails({ fromHoldingId: 'nope', toNewHolding: { name: ' ', assetClass: 'Cash', platform: 'y' } })).toMatchObject({
      status: 400,
      message: 'Name is required',
    });
    expect(await fails({ fromHoldingId: 'nope', toHoldingId: fund.id })).toMatchObject({ status: 404, message: 'Holding nope not found' });
    expect(await fails({ fromHoldingId: savings.id, toHoldingId: 'gone' })).toMatchObject({ status: 404, message: 'Holding gone not found' });

    expect((await api.getHoldings()).map((h) => h.valueUsd)).toEqual([42_350, 12_800, 18_450, 6_120, 15_000, 9_500, 3_200]);
    expect((await api.getMovements()).items).toHaveLength(20);
  });

  it("checks the holdings cap for a transfer's new destination", async () => {
    const { api, holding } = demo();
    for (let i = (await api.getHoldings()).length; i < 1000; i++) {
      await api.createHolding({ name: `h${i}`, assetClass: 'Cash', platform: 'Santander', valueUsd: 0 });
    }
    const savings = await holding('Savings account');

    await expect(
      api.createMovement({
        kind: 'TRANSFER',
        fromHoldingId: savings.id,
        toNewHolding: { name: 'one more', assetClass: 'Cash', platform: 'Balanz' },
        amountUsd: 1,
      }),
    ).rejects.toMatchObject({ status: 409, message: 'You can track up to 1000 holdings. Remove one to add another.' });
    expect(await holding('Savings account')).toMatchObject({ valueUsd: 9_500 });
  });

  it('records holdings being added, edited and removed', async () => {
    const { api, tick } = demo();
    tick();

    const gold = await api.createHolding({ name: 'Gold', assetClass: 'Commodity', platform: 'Vault', valueUsd: 0 });
    const [opening] = (await api.getMovements({ holdingId: gold.id })).items;
    expect(opening).toMatchObject({ kind: 'OPENING', amountUsd: 0, occurredAt: gold.createdAt, revertible: false });

    // A new value is recorded as what the reason says it was, with the values before and after; the
    // movement names the holding as it is after the edit.
    tick();
    await api.updateHolding(gold.id, { name: 'Gold bar', valueUsd: 1_000 });
    tick();
    await api.updateHolding(gold.id, { valueUsd: 900, valueChangeReason: 'MARKET', note: 'Price fell' });
    tick();
    await api.updateHolding(gold.id, { valueUsd: 1_400, valueChangeReason: 'CASH_FLOW', occurredAt: '2026-10-03' });
    tick();
    await api.updateHolding(gold.id, { valueUsd: 1_350, valueChangeReason: 'CASH_FLOW' });
    tick();
    await api.updateHolding(gold.id, { valueUsd: 1_351, valueChangeReason: 'CORRECTION' });
    tick();
    await api.updateHolding(gold.id, { valueUsd: 1_352, valueChangeReason: '' as never });
    // No new value, no movement.
    await api.updateHolding(gold.id, { name: 'Gold bars', valueChangeReason: 'CORRECTION' });

    const { items } = await api.getMovements({ holdingId: gold.id });
    expect(items.map((m) => [m.kind, m.amountUsd, m.previousValueUsd, m.newValueUsd])).toEqual([
      ['GAIN', 1, 1_351, 1_352],
      ['ADJUSTMENT', 1, 1_350, 1_351],
      ['WITHDRAWAL', 50, 1_400, 1_350],
      ['LOSS', 100, 1_000, 900],
      ['GAIN', 1_000, 0, 1_000],
      ['OPENING', 0, null, null],
      ['DEPOSIT', 500, 900, 1_400],
    ]);
    expect(items[3].note).toBe('Price fell');
    expect(items[4].holding).toMatchObject({ name: 'Gold bar', platform: 'Vault' });
    expect(items[6].occurredAt).toBe('2026-10-03T12:00:00.000Z');

    // Checked before anything changes.
    const fails = (patch: object) => api.updateHolding(gold.id, patch as never).catch((e) => e);
    expect(await fails({ valueUsd: 1, valueChangeReason: 'GIFT' })).toMatchObject({
      status: 400,
      message: 'valueChangeReason must be one of MARKET, CASH_FLOW, CORRECTION (got "GIFT")',
    });
    expect(await fails({ valueUsd: 1, note: 'x'.repeat(201) })).toMatchObject({ message: 'Note exceeds max length (201 > 200)' });
    expect(await fails({ valueUsd: 1, occurredAt: '2026-13-01' })).toMatchObject({
      message: 'occurredAt must be a date (YYYY-MM-DD) or a date and time (RFC 3339)',
    });
    expect(await fails({ valueUsd: 1, occurredAt: '2027-01-01' })).toMatchObject({ message: "occurredAt can't be in the future or before 1970" });
    expect((await api.getHoldings()).find((h) => h.id === gold.id)).toMatchObject({ valueUsd: 1_352 });

    // Removed: a CLOSING with its last value; its activity stays, marked as gone.
    tick();
    await api.deleteHolding(gold.id);
    const after = (await api.getMovements({ holdingId: gold.id })).items;
    expect(after[0]).toMatchObject({ kind: 'CLOSING', amountUsd: 1_352, holding: { name: 'Gold bars', exists: false }, revertible: false });
    expect(after.every((m) => !m.revertible && !m.holding!.exists)).toBe(true);
  });

  it('undoes a movement as a delta, keeping what was recorded since', async () => {
    const { api, tick, holding, value } = demo();
    const btc = await holding('Bitcoin');
    tick();
    const gain = await api.createMovement({ kind: 'GAIN', holdingId: btc.id, amountUsd: 1_000 });
    tick();
    await api.updateHolding(btc.id, { valueUsd: 20_000 });

    tick();
    await api.deleteMovement(gain.id);
    expect(await holding('Bitcoin')).toMatchObject({ valueUsd: 19_000, updatedAt: '2026-10-04T10:03:00.000Z' });
    expect((await api.getMovements({ holdingId: btc.id })).items.map((m) => m.id)).not.toContain(gain.id);
    await expect(api.deleteMovement(gain.id)).rejects.toMatchObject({ status: 404, message: `Movement ${gain.id} not found` });

    // A transfer comes back from where it went, fee included.
    const savings = await holding('Savings account');
    const fund = await holding('Emergency fund');
    const transfer = await api.createMovement({ kind: 'TRANSFER', fromHoldingId: savings.id, toHoldingId: fund.id, amountUsd: 100, feeUsd: 1 });
    await api.deleteMovement(transfer.id);
    expect([await value('Savings account'), await value('Emergency fund')]).toEqual([9_500, 3_200]);

    // A correction too.
    await api.updateHolding(btc.id, { valueUsd: 18_000, valueChangeReason: 'CORRECTION' });
    const [correction] = (await api.getMovements({ holdingId: btc.id, kinds: ['ADJUSTMENT'] })).items;
    await api.deleteMovement(correction.id);
    expect(await value('Bitcoin')).toBe(19_000);
  });

  it("refuses to undo what can't be undone", async () => {
    const { api, holding } = demo();
    const all = (await api.getMovements()).items;
    const opening = all.find((m) => m.kind === 'OPENING' && m.holding)!;
    await expect(api.deleteMovement(opening.id)).rejects.toMatchObject({
      status: 409,
      message: "Adding or removing an asset can't be undone here: remove it, or add it again.",
    });
    const debtOpening = all.find((m) => m.kind === 'OPENING' && m.debt)!;
    await expect(api.deleteMovement(debtOpening.id)).rejects.toMatchObject({
      status: 409,
      message: "Adding or removing a debt can't be undone here: remove it, or add it again.",
    });

    // Going below zero: the seeded transfer's 1,200 left the fund since.
    const fund = await holding('Emergency fund');
    await api.createMovement({ kind: 'WITHDRAWAL', holdingId: fund.id, amountUsd: 3_000 });
    const transfer = all.find((m) => m.kind === 'TRANSFER')!;
    await expect(api.deleteMovement(transfer.id)).rejects.toMatchObject({
      status: 409,
      message: 'Emergency fund is worth $200.00: undoing this would take it below zero.',
    });

    // A holding that's gone, named as the movement remembers it.
    const btc = await holding('Bitcoin');
    await api.updateHolding(btc.id, { name: 'BTC' });
    const gain = all.find((m) => m.kind === 'GAIN' && m.holding!.id === btc.id)!;
    await api.deleteHolding(btc.id);
    await expect(api.deleteMovement(gain.id)).rejects.toMatchObject({ status: 409, message: "Bitcoin was removed, so this can't be undone." });
    const closing = (await api.getMovements({ kinds: ['CLOSING'] })).items[0];
    await expect(api.deleteMovement(closing.id)).rejects.toMatchObject({ status: 409 });
  });

  it('lists with filters, a page at a time, stable while new movements come in', async () => {
    const { api, tick, holding } = demo();
    const savings = await holding('Savings account');

    // As origin or destination.
    const fund = await holding('Emergency fund');
    expect((await api.getMovements({ holdingId: fund.id })).items.map((m) => m.kind)).toEqual(['TRANSFER', 'OPENING']);
    // A debt payment made from it is in the holding's activity too.
    expect((await api.getMovements({ holdingId: savings.id })).items.map((m) => m.kind)).toEqual([
      'TRANSFER',
      'DEBT_PAYMENT',
      'DEPOSIT',
      'OPENING',
    ]);
    const visa = (await api.getDebts()).find((d) => d.name === 'Visa Gold')!;
    expect((await api.getMovements({ debtId: visa.id })).items.map((m) => m.kind)).toEqual(['DEBT_PAYMENT', 'DEBT_CHARGE', 'OPENING']);
    expect((await api.getMovements({ kinds: ['GAIN', 'LOSS'] })).items).toHaveLength(4);
    // Dates cover the whole UTC day.
    const day = (await api.getMovements({ from: '2026-09-28', to: '2026-09-28' })).items;
    expect(day.map((m) => m.kind)).toEqual(['TRANSFER']);
    expect((await api.getMovements({ from: '2026-09-28T10:00:00.001Z' })).items.map((m) => m.kind)).toEqual(['DEBT_PAYMENT']);

    const first = await api.getMovements({ limit: 7 });
    expect(first.items).toHaveLength(7);
    // New activity doesn't shift the next page.
    tick();
    await api.createMovement({ kind: 'GAIN', holdingId: savings.id, amountUsd: 1 });
    const second = await api.getMovements({ limit: 7, cursor: first.nextCursor! });
    const third = await api.getMovements({ limit: 7, cursor: second.nextCursor! });
    expect(third.nextCursor).toBeNull();
    const pages = [...first.items, ...second.items, ...third.items];
    expect(pages).toHaveLength(20);
    expect(new Set(pages.map((m) => m.id)).size).toBe(20);
    expect(await api.getMovements({ limit: 7, cursor: first.nextCursor! })).toEqual(second);

    const failure = await api
      .getMovements({ kinds: ['BONUS' as never], from: 'soon', to: '2026-02-30', limit: 500, cursor: 'not*base64' })
      .catch((e) => e);
    expect(failure).toMatchObject({ status: 400 });
    expect(failure.errors.map((e: { message: string }) => e.message)).toEqual([
      'kind must be a comma-separated list of OPENING, CLOSING, GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, ADJUSTMENT, DEBT_PAYMENT, DEBT_CHARGE, DEBT_INTEREST',
      'from must be a date (YYYY-MM-DD) or a date and time (RFC 3339)',
      'to must be a date (YYYY-MM-DD) or a date and time (RFC 3339)',
      'limit must be between 1 and 200',
      'cursor is not one this API gave',
    ]);
    await expect(api.getMovements({ cursor: btoa('[1,2,3]') })).rejects.toMatchObject({ message: 'cursor is not one this API gave' });
  });

  it('keeps to 20,000 movements, CLOSINGs aside', async () => {
    const { api, holding } = demo();
    const { id } = await holding('Bitcoin');
    const [car] = await api.getDebts();
    const seeded = (await api.getMovements({ limit: 200 })).items.length;
    for (let i = seeded; i < 20_000; i++) await api.createMovement({ kind: 'GAIN', holdingId: id, amountUsd: 1 });

    const limit = { status: 409, message: "You've reached the limit of 20000 recorded changes. Undo some to record new ones." };
    await expect(api.createMovement({ kind: 'GAIN', holdingId: id, amountUsd: 1 })).rejects.toMatchObject(limit);
    await expect(api.createMovement({ kind: 'DEBT_INTEREST', debtId: car.id, amountUsd: 1 })).rejects.toMatchObject(limit);
    await expect(api.createHolding({ name: 'x', assetClass: 'Cash', platform: 'y', valueUsd: 1 })).rejects.toMatchObject(limit);
    await expect(api.createDebt({ name: 'x', balanceUsd: 1 })).rejects.toMatchObject(limit);
    await expect(api.updateHolding(id, { valueUsd: 1 })).rejects.toMatchObject(limit);
    await expect(api.updateDebt(car.id, { balanceUsd: 1 })).rejects.toMatchObject(limit);
    expect(await holding('Bitcoin')).toMatchObject({ valueUsd: 18_450 + 20_000 - seeded });
    // Renaming records nothing, and removing always works.
    await expect(api.updateHolding(id, { name: 'BTC' })).resolves.toMatchObject({ name: 'BTC' });
    await expect(api.updateDebt(car.id, { name: 'Car' })).resolves.toMatchObject({ name: 'Car', balanceUsd: 8_400 });
    await api.deleteHolding(id);
    await api.deleteDebt(car.id);

    // Undoing one makes room for one.
    const [latest] = (await api.getMovements({ kinds: ['TRANSFER'] })).items;
    await api.deleteMovement(latest.id);
    const savings = await holding('Savings account');
    await expect(api.createMovement({ kind: 'GAIN', holdingId: savings.id, amountUsd: 1 })).resolves.toBeTruthy();
    await expect(api.createMovement({ kind: 'GAIN', holdingId: savings.id, amountUsd: 1 })).rejects.toMatchObject(limit);
  });
});
