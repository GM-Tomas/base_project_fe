import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movement, MovementHolding } from '@/types/wealth';
import { holding, HOLDINGS, installFakeBackend, json, nav, renderApp, requests, routes } from './harness';

// F2: gains, losses, deposits, withdrawals and transfers; what an edit of a value was; a holding's panel;
// the activity log and undoing. The backend is faked (harness.ts); the app runs for real.

installFakeBackend();

// Dates are "today" in the user's time zone: pinned, so a test means the same thing on any day.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T15:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

const ref = (id: string, name: string, platform: string, assetClass = 'Equity', exists = true): MovementHolding => ({
  id, name, platform, assetClass, exists,
});
const SPY = ref('h1', 'SPY', 'Balanz');
const GOLD = ref('h2', 'Gold bar', 'Vault', 'Gold');
const COINS = ref('h3', 'Coins', 'Vault', 'Gold');

const movement = (id: string, kind: Movement['kind'], over: Partial<Movement> = {}): Movement => ({
  id,
  kind,
  occurredAt: '2026-03-01T12:00:00Z',
  createdAt: '2026-03-01T12:00:00Z',
  amountUsd: 250,
  feeUsd: kind === 'TRANSFER' ? 0 : null,
  holding: SPY,
  toHolding: null,
  debt: null,
  previousValueUsd: null,
  newValueUsd: null,
  note: null,
  revertible: kind !== 'OPENING' && kind !== 'CLOSING',
  ...over,
});

const sent = (method: string, path: string, i = 0) => JSON.parse(requests(method, path)[i][1].body);
const dialog = (name: string) => screen.getByRole('dialog', { name });
const fill = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
const movementsQuery = (i: number) => new URL(requests('GET', '/api/v1/movements')[i][0]).searchParams;

describe('record a change', () => {
  it('records a gain from an asset row, says so, and undoes it from the toast', async () => {
    routes['POST /api/v1/movements'] = () => {
      routes['GET /api/v1/holdings'] = () => json([holding('h1', 'SPY', 'Equity', 'Balanz', 8250), ...HOLDINGS.slice(1)]);
      return json(movement('m1', 'GAIN'), 201);
    };
    routes['DELETE /api/v1/movements/m1'] = () => new Response(null, { status: 204 });
    await renderApp();
    nav('Assets');

    fireEvent.click(screen.getByRole('button', { name: 'Record a change to SPY' }));
    const d = dialog('Record a change');
    expect(within(d).getByText('SPY · Balanz · worth $8,000.00')).toBeTruthy();
    // A gain unless told otherwise, explained; the amount has the focus.
    expect((within(d).getByRole('radio', { name: 'Gain' }) as HTMLInputElement).checked).toBe(true);
    expect(within(d).getByText('Gain: interest, dividends or a rise in price.')).toBeTruthy();
    expect(document.activeElement).toBe(within(d).getByLabelText('Amount (USD)'));

    fill(d, 'Amount (USD)', '250');
    expect(within(d).getByText('SPY: $8,000.00 → $8,250.00')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Record gain' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Today goes without a date (the API stamps it), and no note without one.
    expect(sent('POST', '/api/v1/movements')).toEqual({ kind: 'GAIN', holdingId: 'h1', amountUsd: 250 });
    expect(await screen.findByText('$8,250')).toBeTruthy();
    expect(screen.getByText('Gain recorded')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Change undone')).toBeTruthy();
    expect(requests('DELETE', '/api/v1/movements/m1')).toHaveLength(1);
  });

  it('records a loss on a past day with a note, and checks what it can first', async () => {
    routes['POST /api/v1/movements'] = () => json(movement('m2', 'LOSS'), 201);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Record a change to SPY' }));
    const d = dialog('Record a change');
    fireEvent.click(within(d).getByRole('radio', { name: 'Loss' }));
    expect(within(d).getByText('Loss: a fall in price, or a cost.')).toBeTruthy();
    const submit = () => fireEvent.submit(within(d).getByRole('button', { name: 'Record loss' }).closest('form')!);

    submit();
    expect(within(d).getByText('Please enter an amount')).toBeTruthy();
    fill(d, 'Amount (USD)', '0');
    submit();
    expect(within(d).getByText('The amount must be more than 0')).toBeTruthy();

    // More than it's worth: said right away, and it can't be sent.
    fill(d, 'Amount (USD)', '8.000,01');
    expect(within(d).getByText("That's more than SPY is worth ($8,000.00).")).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Record loss' }).hasAttribute('disabled')).toBe(true);

    fill(d, 'Amount (USD)', '100');
    fill(d, 'Date', '2026-10-06');
    submit();
    expect(within(d).getByText("The date can't be in the future")).toBeTruthy();
    fill(d, 'Date', '');
    submit();
    expect(within(d).getByText('Please pick a date')).toBeTruthy();
    fill(d, 'Date', '2026-10-01');
    fill(d, 'Note (optional)', ' x'.repeat(101));
    submit();
    expect(within(d).getByText('Keep the note under 200 characters')).toBeTruthy();
    expect(requests('POST', '/api/v1/movements')).toHaveLength(0);

    fill(d, 'Note (optional)', '  Broker fees ');
    submit();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/movements')).toEqual({
      kind: 'LOSS',
      holdingId: 'h1',
      amountUsd: 100,
      occurredAt: '2026-10-01',
      note: 'Broker fees',
    });
    expect(screen.getByText('Loss recorded')).toBeTruthy();
  });

  it("shows the API's answer when it refuses, and reloads what's on screen", async () => {
    routes['POST /api/v1/movements'] = () =>
      json({ detail: "SPY is worth $10.00: you can't withdraw more than that." }, 409);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Record a change to SPY' }));
    const d = dialog('Record a change');
    fireEvent.click(within(d).getByRole('radio', { name: 'Withdrawal' }));
    fill(d, 'Amount (USD)', '500');
    fireEvent.click(within(d).getByRole('button', { name: 'Record withdrawal' }));

    expect(await within(d).findByText("SPY is worth $10.00: you can't withdraw more than that.")).toBeTruthy();
    // Changed elsewhere since: fresh data, and the dialog is still there to try again.
    await waitFor(() => expect(requests('GET', '/api/v1/holdings')).toHaveLength(2));
    expect(within(d).getByRole('button', { name: 'Record withdrawal' }).hasAttribute('disabled')).toBe(false);

    routes['POST /api/v1/movements'] = () => Promise.reject(new TypeError('offline'));
    fireEvent.click(within(d).getByRole('button', { name: 'Record withdrawal' }));
    expect(await within(d).findByText("Couldn't record this change. Please try again.")).toBeTruthy();
  });

  it('says so when undoing from the toast fails', async () => {
    routes['POST /api/v1/movements'] = () => json(movement('m1', 'DEPOSIT', { holding: GOLD }), 201);
    routes['DELETE /api/v1/movements/m1'] = () => json({ detail: "Gold bar was removed, so this can't be undone." }, 409);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Record a change to Gold bar' }));
    const d = dialog('Record a change');
    fireEvent.click(within(d).getByRole('radio', { name: 'Deposit' }));
    fill(d, 'Amount (USD)', '1');
    fireEvent.click(within(d).getByRole('button', { name: 'Record deposit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("Gold bar was removed, so this can't be undone.")).toBeTruthy();

    routes['DELETE /api/v1/movements/m1'] = () => Promise.reject(new TypeError('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Record a change to Gold bar' }));
    fill(dialog('Record a change'), 'Amount (USD)', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Record gain' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("Couldn't undo this change. Please try again.")).toBeTruthy();
  });
});

describe('transfer', () => {
  const group = (d: HTMLElement, name: 'From' | 'To') => within(d).getByRole('group', { name });
  const select = (scope: HTMLElement, label: string, value: string) =>
    fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
  const options = (scope: HTMLElement, label: string) =>
    [...(within(scope).getByLabelText(label) as HTMLSelectElement).options].map((o) => o.textContent);
  const valueOf = (scope: HTMLElement, label: string) => (within(scope).getByLabelText(label) as HTMLSelectElement).value;

  it('moves money from an asset to one on another platform, with a fee', async () => {
    routes['POST /api/v1/movements'] = () => json(movement('m3', 'TRANSFER', { toHolding: COINS }), 201);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Transfer from SPY' }));
    const d = dialog('Transfer');
    const from = group(d, 'From');
    const to = group(d, 'To');
    expect(valueOf(from, 'Platform')).toBe('Balanz');
    expect(valueOf(from, 'Asset')).toBe('h1');
    expect(within(from).getByText(/Available: \$8,000\.00/)).toBeTruthy();

    // Two holdings there: pick one (or a new one).
    select(to, 'Platform', 'Vault');
    expect(options(to, 'Asset')).toEqual(['Choose an asset', 'Coins', 'Gold bar', 'A new asset on Vault…']);
    expect(valueOf(to, 'Asset')).toBe('');
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(within(d).getByText('Choose where the money goes')).toBeTruthy();
    select(to, 'Asset', 'h3');

    fireEvent.click(within(from).getByRole('button', { name: 'Max' }));
    expect((within(d).getByLabelText('Amount (USD)') as HTMLInputElement).value).toBe('$8,000.00');
    fill(d, 'Fee (USD, optional)', '5');
    expect(within(d).getByText('Balanz · SPY: $8,000.00 → $0.00')).toBeTruthy();
    expect(within(d).getByText('Vault · Coins: $345.60 → $8,340.60')).toBeTruthy();

    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/movements')).toEqual({
      kind: 'TRANSFER',
      fromHoldingId: 'h1',
      toHoldingId: 'h3',
      amountUsd: 8000,
      feeUsd: 5,
    });
    expect(screen.getByText('Transfer recorded')).toBeTruthy();
  });

  it('moves money to a new asset on a new platform, from a platform card', async () => {
    routes['POST /api/v1/movements'] = () => json(movement('m4', 'TRANSFER', { holding: GOLD, toHolding: ref('h9', 'Gold bar', 'Bank X') }), 201);
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByRole('button', { name: 'Transfer from Vault' }));
    const d = dialog('Transfer');
    const from = group(d, 'From');
    const to = group(d, 'To');

    // Two holdings on Vault: none is picked for the user.
    expect(valueOf(from, 'Platform')).toBe('Vault');
    expect(valueOf(from, 'Asset')).toBe('');
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(within(d).getByText('Choose where the money comes from')).toBeTruthy();
    select(from, 'Asset', 'h2');

    // A new platform: the new asset starts with the source's name and class.
    select(to, 'Platform', ' new platform');
    expect((within(to).getByLabelText('New asset name') as HTMLInputElement).value).toBe('Gold bar');
    expect((within(to).getByLabelText('Asset class') as HTMLInputElement).value).toBe('Gold');
    fill(d, 'Amount (USD)', '100');
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(within(d).getByText('Please enter the new platform')).toBeTruthy();
    fill(to, 'New platform', 'Bank X');
    expect(within(to).getByText('New platform — it will be created')).toBeTruthy();
    fill(to, 'New asset name', ' ');
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(within(d).getByText('Please enter a name for the new asset')).toBeTruthy();
    fill(to, 'New asset name', 'Gold bar');
    fill(to, 'Asset class', '');
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(within(d).getByText('Please choose or enter an asset class')).toBeTruthy();
    fill(to, 'Asset class', 'Gold');
    expect(within(d).getByText('Bank X · Gold bar: $0.00 → $100.00')).toBeTruthy();

    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/movements')).toEqual({
      kind: 'TRANSFER',
      fromHoldingId: 'h2',
      toNewHolding: { name: 'Gold bar', assetClass: 'Gold', platform: 'Bank X' },
      amountUsd: 100,
    });
  });

  it('picks the only holding a platform has, and offers a new one where there is none other', async () => {
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByRole('button', { name: "Vault: show what's there" }));
    fireEvent.click(screen.getByRole('button', { name: 'Transfer from here' }));
    const d = dialog('Transfer');
    const from = group(d, 'From');
    const to = group(d, 'To');

    select(from, 'Platform', 'Balanz');
    expect(valueOf(from, 'Asset')).toBe('h1');
    select(to, 'Platform', 'Balanz');
    expect(options(to, 'Asset')).toEqual(['Choose an asset', 'A new asset on Balanz…']);
    expect(valueOf(to, 'Asset')).toBe(' new asset');
    expect((within(to).getByLabelText('New asset name') as HTMLInputElement).value).toBe('SPY');

    // Picking the destination as the source drops it as the destination.
    select(from, 'Platform', 'Vault');
    select(from, 'Asset', 'h2');
    select(to, 'Platform', 'Vault');
    expect(valueOf(to, 'Asset')).toBe('h3');
    select(from, 'Asset', 'h3');
    expect(valueOf(to, 'Asset')).toBe('');
    select(to, 'Asset', ' new asset');
    expect(within(to).getByLabelText('New asset name')).toBeTruthy();

    // More than there is, or a fee larger than the amount: said right away.
    fill(d, 'Amount (USD)', '346');
    expect(within(d).getByText('You can transfer up to $345.60 from Coins.')).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Transfer' }).hasAttribute('disabled')).toBe(true);
    fill(d, 'Amount (USD)', '10');
    fill(d, 'Fee (USD, optional)', '11');
    expect(within(d).getByText("The fee can't be larger than the amount.")).toBeTruthy();
    fill(d, 'Fee (USD, optional)', '');

    routes['POST /api/v1/movements'] = () => json({ detail: 'You can track up to 1000 holdings. Remove one to add another.' }, 409);
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(await within(d).findByText('You can track up to 1000 holdings. Remove one to add another.')).toBeTruthy();
    routes['POST /api/v1/movements'] = () => Promise.reject(new TypeError('offline'));
    fireEvent.click(within(d).getByRole('button', { name: 'Transfer' }));
    expect(await within(d).findByText("Couldn't record this transfer. Please try again.")).toBeTruthy();
  });
});

describe('editing a value says what it was', () => {
  const open = async () => {
    routes['PATCH /api/v1/holdings/h1'] = () => json(holding('h1', 'SPY', 'Equity', 'Balanz', 9000));
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Edit SPY' }));
    return dialog('Edit asset');
  };

  it('asks only when the value changes: a market move unless told otherwise, today unless another day', async () => {
    const d = await open();
    expect(within(d).queryByText("What's this change?")).toBeNull();
    fill(d, 'Value (USD)', '9000');
    expect(within(d).getByText("What's this change?")).toBeTruthy();
    expect((within(d).getByRole('radio', { name: 'Market move' }) as HTMLInputElement).checked).toBe(true);
    expect(within(d).getByText('Recorded as a gain of $1,000.00.')).toBeTruthy();
    fireEvent.click(within(d).getByRole('radio', { name: 'Money in/out' }));
    expect(within(d).getByText('Recorded as a deposit of $1,000.00.')).toBeTruthy();
    fill(d, 'Value (USD)', '7000');
    expect(within(d).getByText('Recorded as a withdrawal of $1,000.00.')).toBeTruthy();
    fireEvent.click(within(d).getByRole('radio', { name: 'Market move' }));
    expect(within(d).getByText('Recorded as a loss of $1,000.00.')).toBeTruthy();
    fireEvent.click(within(d).getByRole('radio', { name: 'Correction' }));
    expect(within(d).getByText('Recorded as a correction of $1,000.00: not a gain or a loss, nor money in or out.')).toBeTruthy();

    fill(d, 'When', '2026-10-09');
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    expect(within(d).getByText("The date can't be in the future")).toBeTruthy();
    fill(d, 'When', '2026-10-01');
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('PATCH', '/api/v1/holdings/h1')).toEqual({ valueUsd: 7000, valueChangeReason: 'CORRECTION', occurredAt: '2026-10-01' });
  });

  it('sends nothing extra for a market move today', async () => {
    const d = await open();
    fill(d, 'Value (USD)', '9000');
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('PATCH', '/api/v1/holdings/h1')).toEqual({ valueUsd: 9000 });
  });
});

describe("an asset's panel", () => {
  const ACTIVITY = [
    movement('m3', 'TRANSFER', { holding: GOLD, toHolding: SPY, amountUsd: 100, feeUsd: 1, occurredAt: '2026-04-02T12:00:00Z', note: 'Rebalance' }),
    movement('m2', 'LOSS', { amountUsd: 50, occurredAt: '2026-04-01T12:00:00Z', previousValueUsd: 8050, newValueUsd: 8000 }),
    movement('m1', 'OPENING', { amountUsd: 8050, occurredAt: '2026-01-01T12:00:00Z' }),
  ];

  it('opens from its row with what it is, its actions and its activity; closes back to the row', async () => {
    routes['GET /api/v1/movements'] = () => json({ items: ACTIVITY, nextCursor: null });
    await renderApp();
    nav('Assets');

    // A click anywhere on the row (but its buttons) opens it.
    fireEvent.click(within(screen.getByRole('row', { name: /SPY/ })).getByText('$8,000'));
    const panel = dialog('SPY');
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Close' }));
    expect(within(panel).getByText('$8,000.00')).toBeTruthy();
    expect(within(panel).getByText(/^Added \w{3} \d+, \d{4} · Updated \w{3} \d+, \d{4}$/)).toBeTruthy();

    const rows = await within(panel).findAllByRole('listitem');
    expect(movementsQuery(0).get('holdingId')).toBe('h1');
    expect(movementsQuery(0).get('limit')).toBe('50');
    expect(rows.map((r) => within(r).getByText(/^(Transfer|Loss|Added)/).textContent)).toEqual([
      'Transfer from Gold bar',
      'Loss',
      'Added',
    ]);
    expect(within(rows[0]).getByText('Apr 2, 2026 · Vault · Fee $1.00')).toBeTruthy();
    expect(within(rows[0]).getByText('“Rebalance”')).toBeTruthy();
    expect(within(rows[0]).getByText('+$99.00')).toBeTruthy();
    expect(within(rows[1]).getByText('Apr 1, 2026 · $8,050.00 → $8,000.00')).toBeTruthy();
    expect(within(rows[1]).getByText('−$50.00')).toBeTruthy();
    expect(within(rows[2]).getByText('$8,050.00')).toBeTruthy();
    // What can be undone says so; adding an asset can't be.
    expect(within(rows[1]).getByRole('button', { name: 'Undo loss of $50.00 on SPY' })).toBeTruthy();
    expect(within(rows[2]).queryByRole('button')).toBeNull();

    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'SPY' }));
  });

  it('acts on the asset from the panel, and closes once it is gone', async () => {
    routes['DELETE /api/v1/holdings/h1'] = () => {
      routes['GET /api/v1/holdings'] = () => json(HOLDINGS.slice(1));
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'SPY' }));
    const panel = dialog('SPY');
    expect(await within(panel).findByText('Nothing recorded for this asset yet')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Record a change' }));
    expect(dialog('Record a change')).toBeTruthy();
    fireEvent.keyDown(dialog('Record a change'), { key: 'Escape' });
    // Only the dialog on top closes.
    expect(dialog('SPY')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Transfer' }));
    expect(screen.getByRole('dialog', { name: 'Transfer' })).toBeTruthy();
    fireEvent.click(within(dialog('Transfer')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(dialog('Edit asset')).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(panel).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(dialog('Remove asset?')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Asset removed')).toBeTruthy();
  });

  it("opens from a platform's holdings, and goes to its platform", async () => {
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByRole('button', { name: "Vault: show what's there" }));
    fireEvent.click(screen.getByRole('button', { name: 'Coins' }));
    const panel = dialog('Coins');
    fireEvent.click(within(panel).getByRole('button', { name: 'Vault' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText("Vault · what's there")).toBeTruthy();
  });

  it('loads more, a page at a time, and retries when loading fails', async () => {
    let calls = 0;
    routes['GET /api/v1/movements'] = () => {
      calls++;
      if (calls === 1) return Promise.reject(new TypeError('offline'));
      return json(calls === 2 ? { items: ACTIVITY.slice(0, 2), nextCursor: 'c1' } : { items: ACTIVITY.slice(2), nextCursor: null });
    };
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'SPY' }));
    const panel = dialog('SPY');

    expect(await within(panel).findByText("Couldn't load the activity. Please try again.")).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(within(panel).getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(3));
    expect(movementsQuery(2).get('cursor')).toBe('c1');
    expect(within(panel).queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('activity', () => {
  const ALL = [
    movement('m5', 'TRANSFER', { holding: GOLD, toHolding: COINS, amountUsd: 100, feeUsd: 2 }),
    movement('m4', 'ADJUSTMENT', { holding: COINS, amountUsd: 10, previousValueUsd: 355.6, newValueUsd: 345.6 }),
    movement('m3', 'GAIN', { holding: ref('h7', 'Bitcoin', 'Binance', 'Crypto', false), revertible: false }),
    movement('m2', 'CLOSING', { holding: ref('h7', 'Bitcoin', 'Binance', 'Crypto', false), amountUsd: 18_450 }),
    movement('m1', 'DEPOSIT', { amountUsd: 1_000, note: 'Salary' }),
  ];

  it('lists everything recorded, newest first, and filters it by kind and by asset', async () => {
    routes['GET /api/v1/movements'] = () => json({ items: ALL, nextCursor: null });
    await renderApp();
    nav('History');

    const list = await screen.findByRole('list', { name: 'Activity' });
    const titles = within(list)
      .getAllByRole('listitem')
      .map((r) => r.querySelector('.activity-title')!.textContent);
    expect(titles).toEqual([
      'Transfer · Gold bar → Coins',
      'Correction · Coins',
      'Gain · Bitcoin (deleted)',
      'Removed · Bitcoin (deleted)',
      'Deposit · SPY',
    ]);
    const [transfer, correction, gain] = within(list).getAllByRole('listitem');
    // A transfer only moved money: no sign. A correction says what it did.
    expect(within(transfer).getByText('$100.00')).toBeTruthy();
    expect(within(transfer).getByText('Mar 1, 2026 · Vault · Fee $2.00')).toBeTruthy();
    expect(within(correction).getByText('−$10.00')).toBeTruthy();
    expect(within(gain).queryByRole('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(2));
    expect(movementsQuery(1).get('kind')).toBe('TRANSFER');
    expect(screen.getByRole('button', { name: 'Transfers' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Gains & losses' }));
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(3));
    expect(movementsQuery(2).get('kind')).toBe('GAIN,LOSS');

    fireEvent.change(screen.getByLabelText('Filter by asset'), { target: { value: 'holding:h3' } });
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(4));
    expect(movementsQuery(3).get('holdingId')).toBe('h3');
    expect(movementsQuery(3).get('kind')).toBe('GAIN,LOSS');

    routes['GET /api/v1/movements'] = () => json({ items: [], nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByText('Nothing recorded matches this filter')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by asset'), { target: { value: '' } });
    expect(await screen.findByText('Nothing recorded in this period')).toBeTruthy();
    // History's period: a year back from today, until now.
    expect(new Date(movementsQuery(5).get('from')!)).toEqual(new Date(2025, 9, 5));
    expect(movementsQuery(5).get('to')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(await screen.findByText('Nothing recorded yet: gains, losses, deposits and transfers show up here.')).toBeTruthy();
    expect(movementsQuery(6).get('from')).toBeNull();
  });

  it('undoes a change after asking, then reloads everything', async () => {
    routes['GET /api/v1/movements'] = () => json({ items: ALL, nextCursor: null });
    routes['DELETE /api/v1/movements/m5'] = () => {
      routes['GET /api/v1/movements'] = () => json({ items: ALL.slice(1), nextCursor: null });
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('History');

    fireEvent.click(await screen.findByRole('button', { name: 'Undo transfer of $100.00 from Gold bar to Coins' }));
    const confirm = dialog('Undo this change?');
    expect(
      within(confirm).getByText(
        'Transfer of $100.00 from Gold bar to Coins (Mar 1, 2026). Undoing it puts $100.00 back on Gold bar and takes $98.00 off Coins.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Change undone')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Transfer · Gold bar → Coins')).toBeNull());
    expect(requests('GET', '/api/v1/holdings')).toHaveLength(2);
  });

  it("keeps the confirmation open with the API's reason when it can't be undone", async () => {
    routes['GET /api/v1/movements'] = () => json({ items: ALL, nextCursor: null });
    routes['DELETE /api/v1/movements/m1'] = () => json({ detail: 'SPY is worth $500.00: undoing this would take it below zero.' }, 409);
    await renderApp();
    nav('History');

    fireEvent.click(await screen.findByRole('button', { name: 'Undo deposit of $1,000.00 on SPY' }));
    const confirm = dialog('Undo this change?');
    expect(within(confirm).getByText('Deposit of $1,000.00 on SPY (Mar 1, 2026). Undoing it takes $1,000.00 off SPY.')).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Undo' }));
    expect(await within(confirm).findByText('SPY is worth $500.00: undoing this would take it below zero.')).toBeTruthy();
    // What's on screen may be out of date: reloaded.
    await waitFor(() => expect(requests('GET', '/api/v1/holdings')).toHaveLength(2));
  });

  it("drops a page asked for before the activity reloaded", async () => {
    let resolveMore!: (r: Response) => void;
    routes['GET /api/v1/movements'] = () => json({ items: ALL.slice(0, 1), nextCursor: 'c1' });
    await renderApp();
    nav('History');
    await screen.findByText('Transfer · Gold bar → Coins');
    routes['GET /api/v1/movements'] = () => new Promise<Response>((resolve) => (resolveMore = resolve));
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeTruthy();
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(2));

    // A filter changes meanwhile: the page that comes back belongs to the old list.
    routes['GET /api/v1/movements'] = () => json({ items: ALL.slice(1, 2), nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'Corrections' }));
    await screen.findByText('Correction · Coins');
    await act(async () => resolveMore(json({ items: ALL.slice(4), nextCursor: null })));
    expect(screen.queryByText('Deposit · SPY')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Activity' })).getAllByRole('listitem')).toHaveLength(1);
  });
});
