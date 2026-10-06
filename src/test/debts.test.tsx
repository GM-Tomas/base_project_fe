import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, Movement, MovementDebt } from '@/types/wealth';
import { installFakeBackend, json, nav, newItem, point, projection, renderApp, requests, routes, snapshot, summary } from './harness';

// F3: debts. The Debts view, adding, editing and removing one, paying it (from an asset or not), new charges
// and interest, its panel, and what debts do to the dashboard, Estimate and History. The backend is faked
// (harness.ts); the app runs for real.

installFakeBackend();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T15:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

const none = { months: null, payoffMonth: null, totalInterestUsd: null };
const debt = (id: string, name: string, over: Partial<Debt> = {}): Debt => ({
  id,
  name,
  lender: null,
  kind: 'OTHER',
  balanceUsd: 1_000,
  interestRatePct: null,
  monthlyPaymentUsd: null,
  dueDay: null,
  notes: null,
  createdAt: '2026-01-10T12:00:00Z',
  updatedAt: '2026-02-10T12:00:00Z',
  payoff: { status: 'NO_PAYMENT', ...none },
  ...over,
});

const VISA = debt('d1', 'Visa', {
  lender: 'Santander',
  kind: 'CREDIT_CARD',
  balanceUsd: 1_250.4,
  interestRatePct: 65,
  monthlyPaymentUsd: 300,
  dueDay: 10,
  notes: 'Closes on the 3rd',
  payoff: { status: 'ON_TRACK', months: 5, payoffMonth: '2027-03', totalInterestUsd: 205.72 },
});
const LOAN = debt('d2', 'Car loan', {
  lender: 'Galicia',
  kind: 'LOAN',
  balanceUsd: 8_400,
  interestRatePct: 90,
  monthlyPaymentUsd: 100,
  payoff: { status: 'NEVER', ...none },
});
const MOM = debt('d3', 'Mom', { kind: 'PERSONAL', balanceUsd: 500 });
const DEBTS = [LOAN, VISA, MOM];
// What's owned less what's owed is still the harness's 12,345.60.
const OWING = summary({ assets: { usd: 22_496 }, debts: { usd: 10_150.4, count: 3, monthlyPaymentUsd: 400 } });

const VISA_REF: MovementDebt = { id: 'd1', name: 'Visa', lender: 'Santander', exists: true };
const movement = (id: string, kind: Movement['kind'], over: Partial<Movement> = {}): Movement => ({
  id,
  kind,
  occurredAt: '2026-09-20T12:00:00Z',
  createdAt: '2026-09-20T12:00:00Z',
  amountUsd: 300,
  feeUsd: null,
  holding: null,
  toHolding: null,
  debt: VISA_REF,
  previousValueUsd: null,
  newValueUsd: null,
  note: null,
  revertible: kind !== 'OPENING' && kind !== 'CLOSING',
  ...over,
});
const COINS = { id: 'h3', name: 'Coins', platform: 'Vault', assetClass: 'Gold', exists: true };

const sent = (method: string, path: string, i = 0) => JSON.parse(requests(method, path)[i][1].body);
const dialog = (name: string) => screen.getByRole('dialog', { name });
const fill = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
const radio = (scope: HTMLElement, name: string) => within(scope).getByRole('radio', { name }) as HTMLInputElement;
const row = (name: string) => screen.getByRole('button', { name }).closest('tr') as HTMLElement;

function withDebts() {
  routes['GET /api/v1/debts'] = () => json(DEBTS);
  routes['GET /api/v1/wealth/summary'] = () => json(OWING);
}

describe('Debts view', () => {
  it('starts empty, with what goes there and a way to add one', async () => {
    await renderApp();
    nav('Debts');

    expect(screen.getByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(screen.getByText("What you owe, what it costs and when it's paid off.")).toBeTruthy();
    expect(screen.getByText('Nothing owed')).toBeTruthy();
    expect(screen.getByText('If you have a card balance, a loan or a mortgage, add it to see your real net worth.')).toBeTruthy();
    // New ▾ in the header adds a debt, as the empty state's button does.
    newItem('Debt');
    fireEvent.click(within(dialog('Add a debt')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a debt' }));
    expect(dialog('Add a debt')).toBeTruthy();
  });

  it('sums up what is owed, and lists each debt with its terms and payoff', async () => {
    withDebts();
    await renderApp();
    nav('Debts');

    const overview = document.querySelector('.debt-overview') as HTMLElement;
    const card = (kicker: string) => within(overview).getByText(kicker).closest('.card') as HTMLElement;
    expect(within(card('You owe')).getByText('$10,150')).toBeTruthy();
    expect(within(card('You owe')).getByText('3 debts')).toBeTruthy();
    expect(within(card('Monthly payments')).getByText('$400')).toBeTruthy();
    expect(within(card('Monthly payments')).getByText('For 2 of 3 debts')).toBeTruthy();
    // (8,400 × 90 + 1,250.40 × 65) / 9,650.40: Mom has no rate.
    expect(within(card('Average rate')).getByText('86.8%')).toBeTruthy();
    expect(within(card('Debt-free')).getByText('Never')).toBeTruthy();
    expect(within(card('Debt-free')).getByText('Car loan never gets paid off at its payment')).toBeTruthy();

    const visa = row('Visa');
    expect(within(visa).getByText('Santander · Credit card')).toBeTruthy();
    expect(within(visa).getByText('$1,250')).toBeTruthy();
    expect(within(visa).getByText('65%')).toBeTruthy();
    expect(within(visa).getByText('$300')).toBeTruthy();
    expect(within(visa).getByText('Due on the 10th')).toBeTruthy();
    expect(within(visa).getByText('Paid off in 5 months · Mar 2027')).toBeTruthy();
    expect(within(row('Car loan')).getByText('Never at this payment')).toBeTruthy();
    expect(within(row('Mom')).getByText("Add a monthly payment to see when it's paid off")).toBeTruthy();
    expect(within(row('Mom')).getByText('Personal')).toBeTruthy();
    expect(screen.getByText('3 debts · $10,150')).toBeTruthy();
  });

  it('says when it is all paid off when every debt has a payment that covers it', async () => {
    routes['GET /api/v1/debts'] = () =>
      json([VISA, debt('d4', 'Done', { balanceUsd: 0, monthlyPaymentUsd: 50, payoff: { status: 'PAID_OFF', ...none } })]);
    await renderApp();
    nav('Debts');

    expect(screen.getByText('Debt-free by')).toBeTruthy();
    expect(screen.getByText('Mar 2027')).toBeTruthy();
    expect(screen.getByText('If you keep up the monthly payments')).toBeTruthy();
    expect(within(row('Done')).getByText('Paid off')).toBeTruthy();
    expect(screen.getByText('For both debts')).toBeTruthy();
  });
});

describe('Debts view, without the terms', () => {
  it('says what is missing to work out the totals', async () => {
    routes['GET /api/v1/debts'] = () => json([MOM]);
    await renderApp();
    nav('Debts');

    expect(screen.getByText('1 debt')).toBeTruthy();
    expect(screen.getByText('None set yet')).toBeTruthy();
    expect(screen.getByText('Add the rates to see it')).toBeTruthy();
    expect(screen.getByText('Not known yet')).toBeTruthy();
    expect(screen.getByText('Add a monthly payment to Mom to see when')).toBeTruthy();
    expect(within(row('Mom')).getAllByText('—')).toHaveLength(2);
  });
});

describe('add, edit and remove a debt', () => {
  it('adds a debt, saying when it would be paid off as the terms are typed', async () => {
    routes['POST /api/v1/debts'] = () => {
      routes['GET /api/v1/debts'] = () => json([VISA]);
      return json(VISA, 201);
    };
    await renderApp();
    nav('Debts');
    newItem('Debt');
    const d = dialog('Add a debt');

    // What's missing, one thing at a time.
    fireEvent.click(within(d).getByRole('button', { name: 'Save debt' }));
    expect(within(d).getByText('Please enter a name')).toBeTruthy();
    fill(d, 'Name', ' Visa ');
    fireEvent.click(within(d).getByRole('button', { name: 'Save debt' }));
    expect(within(d).getByText("Please enter what's left to pay")).toBeTruthy();

    fill(d, 'Lender (optional)', 'Santander');
    fill(d, 'Kind', 'CREDIT_CARD');
    fill(d, 'Left to pay (USD)', '1.250,40');
    expect(within(d).getByText("Add a monthly payment to see when it's paid off")).toBeTruthy();
    fill(d, 'Interest (% a year, optional)', '250');
    expect(within(d).getByText("The rate can't be over 200%")).toBeTruthy();
    fill(d, 'Interest (% a year, optional)', '65%');
    // 1,250.40 at 65% is $67.73 of interest a month.
    fill(d, 'Monthly payment (optional)', '60');
    expect(within(d).getByText('Never at this payment')).toBeTruthy();
    fill(d, 'Monthly payment (optional)', '300');
    expect(within(d).getByText('Paid off in 5 months · Mar 2027')).toBeTruthy();
    expect(within(d).getByText(/in interest until then$/)).toBeTruthy();
    fill(d, 'Due day (optional)', '32');
    expect(within(d).getByText('Pick a day between 1 and 31')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save debt' }));
    expect(within(d).getByText('Due day: Pick a day between 1 and 31')).toBeTruthy();
    fill(d, 'Due day (optional)', '10');
    fill(d, 'Notes (optional)', ' Closes on the 3rd ');
    fireEvent.click(within(d).getByRole('button', { name: 'Save debt' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/debts')).toEqual({
      name: 'Visa',
      kind: 'CREDIT_CARD',
      balanceUsd: 1_250.4,
      lender: 'Santander',
      interestRatePct: 65,
      monthlyPaymentUsd: 300,
      dueDay: 10,
      notes: 'Closes on the 3rd',
    });
    expect(screen.getByText('Debt added')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Visa' })).toBeTruthy();
  });

  it('sends only what is filled in, and says what the API refused', async () => {
    routes['POST /api/v1/debts'] = () =>
      json({ status: 409, detail: 'You can track up to 200 debts. Remove one to add another.' }, 409);
    await renderApp();
    nav('Debts');
    newItem('Debt');
    const d = dialog('Add a debt');

    fill(d, 'Name', 'Mom');
    fill(d, 'Left to pay (USD)', '500');
    fireEvent.click(within(d).getByRole('button', { name: 'Save debt' }));

    expect(await within(d).findByText('You can track up to 200 debts. Remove one to add another.')).toBeTruthy();
    expect(sent('POST', '/api/v1/debts')).toEqual({ name: 'Mom', kind: 'OTHER', balanceUsd: 500 });
  });

  it('edits a debt: only what changed, with what a new balance was', async () => {
    withDebts();
    routes['PATCH /api/v1/debts/d1'] = () => json({ ...VISA, balanceUsd: 1_000, interestRatePct: null });
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Visa' }));
    const d = dialog('Edit debt');

    // Nothing changed yet: nothing to save.
    const save = within(d).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((within(d).getByLabelText('Left to pay (USD)') as HTMLInputElement).value).toBe('1250.4');
    expect(within(d).queryByRole('radio')).toBeNull();

    // Lower: a payment or a correction (the default).
    fill(d, 'Left to pay (USD)', '1000');
    expect(within(d).queryByRole('radio', { name: 'New charges' })).toBeNull();
    expect(radio(d, 'Correction').checked).toBe(true);
    expect(within(d).getByText('Recorded as a correction of $250.40: the balance was off, nothing was paid or charged.')).toBeTruthy();
    fireEvent.click(radio(d, 'Payment'));
    expect(within(d).getByText('Recorded as a payment of $250.40.')).toBeTruthy();
    // Higher: charges, interest or a correction; a payment doesn't fit anymore.
    fill(d, 'Left to pay (USD)', '1300');
    expect(within(d).queryByRole('radio', { name: 'Payment' })).toBeNull();
    expect(radio(d, 'Correction').checked).toBe(true);
    fireEvent.click(radio(d, 'Interest'));
    expect(within(d).getByText('Recorded as interest of $49.60.')).toBeTruthy();
    fireEvent.click(radio(d, 'New charges'));
    expect(within(d).getByText('Recorded as new charges of $49.60.')).toBeTruthy();

    fill(d, 'Left to pay (USD)', '1000');
    fireEvent.click(radio(d, 'Payment'));
    fill(d, 'When', '2026-10-01');
    fill(d, 'Interest (% a year, optional)', '');
    fill(d, 'Lender (optional)', 'Santander ');
    fireEvent.click(save);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('PATCH', '/api/v1/debts/d1')).toEqual({
      balanceUsd: 1_000,
      balanceChangeReason: 'PAYMENT',
      occurredAt: '2026-10-01',
      interestRatePct: null,
    });
    expect(screen.getByText('Changes saved')).toBeTruthy();
  });

  it('clears the terms that are emptied, and says when the debt is gone', async () => {
    withDebts();
    routes['PATCH /api/v1/debts/d1'] = () => json({ status: 404, detail: 'Debt d1 not found' }, 404);
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Visa' }));
    const d = dialog('Edit debt');

    fill(d, 'Lender (optional)', '');
    fill(d, 'Monthly payment (optional)', '');
    fill(d, 'Due day (optional)', '');
    fill(d, 'Notes (optional)', '');
    // An empty balance can't be saved: Save says why.
    fill(d, 'Left to pay (USD)', '');
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));
    expect(within(d).getByText("Please enter what's left to pay")).toBeTruthy();
    fill(d, 'Left to pay (USD)', '1250.40');
    fill(d, 'Kind', 'LOAN');
    fill(d, 'Name', 'Visa Gold');
    expect(within(d).getByText("Add a monthly payment to see when it's paid off")).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save changes' }));

    expect(await within(d).findByText('Debt d1 not found')).toBeTruthy();
    expect(sent('PATCH', '/api/v1/debts/d1')).toEqual({
      name: 'Visa Gold',
      lender: null,
      kind: 'LOAN',
      monthlyPaymentUsd: null,
      dueDay: null,
      notes: null,
    });
    // What's on screen is out of date: reloaded.
    await waitFor(() => expect(requests('GET', '/api/v1/debts')).toHaveLength(2));
  });

  it('removes a debt after asking', async () => {
    withDebts();
    routes['DELETE /api/v1/debts/d1'] = () => {
      routes['GET /api/v1/debts'] = () => json([LOAN, MOM]);
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Visa' }));
    const confirm = dialog('Remove Visa?');

    expect(
      within(confirm).getByText(
        'Its balance ($1,250) will stop counting against your net worth. What was recorded on it stays in your activity.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Debt removed')).toBeTruthy();
    expect(requests('DELETE', '/api/v1/debts/d1')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Visa' })).toBeNull());
  });
});

describe('payments, new charges and interest', () => {
  it('pays a debt from an asset, starting at the monthly payment, and undoes it from the toast', async () => {
    withDebts();
    routes['POST /api/v1/movements'] = () => json(movement('m1', 'DEBT_PAYMENT', { holding: COINS }), 201);
    routes['DELETE /api/v1/movements/m1'] = () => new Response(null, { status: 204 });
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Pay Visa' }));
    const d = dialog('Record a payment');

    expect(within(d).getByText('Visa · Santander · $1,250.40 left to pay')).toBeTruthy();
    expect(radio(d, 'Pay').checked).toBe(true);
    const amount = within(d).getByLabelText('Amount (USD)') as HTMLInputElement;
    expect(amount.value).toBe('$300.00');
    expect(document.activeElement).toBe(amount);
    expect(within(d).getByText('Visa: $1,250.40 → $950.40 left to pay')).toBeTruthy();

    fireEvent.click(within(d).getByRole('button', { name: 'Full balance' }));
    expect(amount.value).toBe('$1,250.40');
    expect(within(d).getByText('Visa: $1,250.40 → $0.00 left to pay · paid off')).toBeTruthy();
    fill(d, 'Amount (USD)', '2000');
    expect(within(d).getByText("That's more than what's left to pay on Visa ($1,250.40).")).toBeTruthy();
    expect((within(d).getByRole('button', { name: 'Record payment' }) as HTMLButtonElement).disabled).toBe(true);

    // From an asset: it goes down too, and never below zero.
    fill(d, 'Paid from (optional)', 'h3');
    fill(d, 'Amount (USD)', '400');
    expect(within(d).getByText("That's more than Coins is worth ($345.60).")).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Monthly payment' }));
    expect(within(d).getByText('Coins: $345.60 → $45.60')).toBeTruthy();
    fill(d, 'Note (optional)', 'October');
    fireEvent.click(within(d).getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/movements')).toEqual({
      kind: 'DEBT_PAYMENT',
      debtId: 'd1',
      amountUsd: 300,
      note: 'October',
      fromHoldingId: 'h3',
    });
    expect(screen.getByText('Payment recorded')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Change undone')).toBeTruthy();
    expect(requests('DELETE', '/api/v1/movements/m1')).toHaveLength(1);
  });

  it('records a new charge into an asset, or interest, and only a payment starts filled in', async () => {
    withDebts();
    routes['POST /api/v1/movements'] = () => json(movement('m2', 'DEBT_CHARGE'), 201);
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Pay Visa' }));
    let d = dialog('Record a payment');

    // The amount was untouched: switching drops it, and coming back fills it in again.
    fireEvent.click(radio(d, 'New charge'));
    d = dialog('Record a new charge');
    const amount = within(d).getByLabelText('Amount (USD)') as HTMLInputElement;
    expect(amount.value).toBe('');
    expect(within(d).getByText('A new charge: purchases with the card, or more money borrowed.')).toBeTruthy();
    expect(within(d).queryByRole('button', { name: 'Full balance' })).toBeNull();
    fireEvent.click(radio(d, 'Pay'));
    expect(amount.value).toBe('$300.00');

    // Where a payment came from isn't where a charge goes.
    fill(d, 'Paid from (optional)', 'h3');
    fireEvent.click(radio(d, 'New charge'));
    expect((within(dialog('Record a new charge')).getByLabelText('Money went to (optional)') as HTMLSelectElement).value).toBe('');
    fireEvent.click(radio(dialog('Record a new charge'), 'Interest'));
    d = dialog('Record interest');
    expect(within(d).queryByLabelText('Money went to (optional)')).toBeNull();
    fireEvent.click(radio(d, 'New charge'));
    d = dialog('Record a new charge');
    fill(d, 'Money went to (optional)', 'h1');
    fill(d, 'Amount (USD)', '50');
    expect(within(d).getByText('Visa: $1,250.40 → $1,300.40 left to pay')).toBeTruthy();
    expect(within(d).getByText('SPY: $8,000.00 → $8,050.00')).toBeTruthy();
    fill(d, 'Date', '2026-10-01');
    fireEvent.click(within(d).getByRole('button', { name: 'Record charge' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/movements')).toEqual({
      kind: 'DEBT_CHARGE',
      debtId: 'd1',
      amountUsd: 50,
      occurredAt: '2026-10-01',
      toHoldingId: 'h1',
    });
    expect(screen.getByText('New charge recorded')).toBeTruthy();
  });

  it('says what is wrong before sending, and what the API refused', async () => {
    withDebts();
    routes['POST /api/v1/movements'] = () => json({ status: 409, detail: 'Visa only has $1,000.00 left to pay.' }, 409);
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Pay Mom' }));
    const d = dialog('Record a payment');

    // No monthly payment: nothing to start from.
    expect((within(d).getByLabelText('Amount (USD)') as HTMLInputElement).value).toBe('');
    expect(within(d).queryByRole('button', { name: 'Monthly payment' })).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Record payment' }));
    expect(within(d).getByText('Please enter an amount')).toBeTruthy();
    fill(d, 'Amount (USD)', '0');
    fireEvent.click(within(d).getByRole('button', { name: 'Record payment' }));
    expect(within(d).getByText('The amount must be more than 0')).toBeTruthy();
    fill(d, 'Amount (USD)', '100');
    fill(d, 'Date', '2026-10-06');
    fireEvent.click(within(d).getByRole('button', { name: 'Record payment' }));
    expect(within(d).getByText("The date can't be in the future")).toBeTruthy();
    fill(d, 'Date', '2026-10-05');
    fireEvent.click(within(d).getByRole('button', { name: 'Record payment' }));

    expect(await within(d).findByText('Visa only has $1,000.00 left to pay.')).toBeTruthy();
    // A refusal like that means what's on screen is out of date: reloaded.
    await waitFor(() => expect(requests('GET', '/api/v1/debts')).toHaveLength(2));
  });
});

describe("a debt's panel", () => {
  it('shows its terms, payoff and activity, and what can be done with it', async () => {
    withDebts();
    routes['GET /api/v1/movements'] = () =>
      json({
        items: [
          movement('m3', 'DEBT_PAYMENT', { holding: COINS }),
          movement('m2', 'ADJUSTMENT', { amountUsd: 49.6, previousValueUsd: 1_300, newValueUsd: 1_250.4 }),
          movement('m1', 'OPENING', { amountUsd: 1_300, occurredAt: '2026-01-10T12:00:00Z' }),
        ],
        nextCursor: null,
      });
    await renderApp();
    nav('Debts');
    // A click anywhere on the row opens it.
    fireEvent.click(within(row('Visa')).getByText('Due on the 10th'));
    const panel = dialog('Visa');

    expect(within(panel).getByText('Santander')).toBeTruthy();
    expect(within(panel).getByText('Credit card')).toBeTruthy();
    expect(within(panel).getByText('$1,250.40')).toBeTruthy();
    expect(within(panel).getByText('Left to pay · Added Jan 10, 2026 · Updated Feb 10, 2026')).toBeTruthy();
    expect(within(panel).getByText('65% a year')).toBeTruthy();
    expect(within(panel).getByText('$300.00')).toBeTruthy();
    expect(within(panel).getByText('On the 10th')).toBeTruthy();
    expect(within(panel).getByText('Paid off in 5 months · Mar 2027')).toBeTruthy();
    expect(within(panel).getByText('$205.72 in interest until then')).toBeTruthy();
    expect(within(panel).getByText('Closes on the 3rd')).toBeTruthy();

    // Its own activity: what each change did to what's owed.
    const list = await within(panel).findByRole('list', { name: 'Activity' });
    expect(new URL(requests('GET', '/api/v1/movements')[0][0]).searchParams.get('debtId')).toBe('d1');
    const titles = within(list)
      .getAllByRole('listitem')
      .map((r) => r.querySelector('.activity-title')!.textContent);
    expect(titles).toEqual(['Payment', 'Correction', 'Added']);
    const [payment, correction] = within(list).getAllByRole('listitem');
    expect(within(payment).getByText('Sep 20, 2026 · from Coins')).toBeTruthy();
    expect(within(payment).getByText('−$300.00').className).toContain('amount-positive');
    expect(within(correction).getByText('−$49.60')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Interest' }));
    expect(radio(dialog('Record interest'), 'Interest').checked).toBe(true);
    fireEvent.click(within(dialog('Record interest')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'New charge' }));
    fireEvent.click(within(dialog('Record a new charge')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(dialog('Edit debt')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Pay' }));
    expect(dialog('Record a payment')).toBeTruthy();
  });

  it("closes once the debt is gone, and says when it's never paid off", async () => {
    withDebts();
    routes['DELETE /api/v1/debts/d2'] = () => {
      routes['GET /api/v1/debts'] = () => json([VISA, MOM]);
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('Debts');
    fireEvent.click(screen.getByRole('button', { name: 'Car loan' }));
    const panel = dialog('Car loan');

    expect(within(panel).getByText('Never at this payment')).toBeTruthy();
    expect(within(panel).getByText(/doesn't cover the interest/)).toBeTruthy();
    expect(await within(panel).findByText('Nothing recorded for this debt yet')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(dialog('Remove Car loan?')).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Debt removed')).toBeTruthy();
  });
});

describe('net worth with debts', () => {
  it('shows the net worth with the assets and debts behind it, and what is owed', async () => {
    withDebts();
    await renderApp();

    expect(screen.getByText('Your net worth, right now')).toBeTruthy();
    expect(screen.getByText('Assets $22,496 · Debts $10,150')).toBeTruthy();
    const owe = screen.getByText('You owe').closest('button') as HTMLElement;
    expect(within(owe).getByText('$10,150')).toBeTruthy();
    expect(within(owe).getByText('3 debts · $400 a month')).toBeTruthy();
    fireEvent.click(owe);
    expect(screen.getByRole('heading', { name: 'Debts' })).toBeTruthy();
  });

  it('shows a net worth below zero in red, and nothing owed without debts', async () => {
    routes['GET /api/v1/wealth/summary'] = () =>
      json(summary({ netWorth: { usd: -5_000 }, assets: { usd: 1_000 }, debts: { usd: 6_000, count: 1, monthlyPaymentUsd: 0 } }));
    routes['GET /api/v1/debts'] = () => json([MOM]);
    await renderApp(undefined, '−$5,000');

    expect(screen.getByText('−$5,000').style.color).toBe('var(--color-negative)');
    expect(screen.getByText('1 debt')).toBeTruthy();
  });

  it('has nothing owed on the dashboard without debts, and the hero has no split', async () => {
    await renderApp();

    expect(screen.getByText('Nothing owed')).toBeTruthy();
    expect(screen.getByText('Cards, loans or a mortgage go in Debts')).toBeTruthy();
    expect(document.querySelector('.hero-split')).toBeNull();
  });

  it("draws Estimate's net worth line with a legend when there are debts", async () => {
    routes['GET /api/v1/wealth/estimate'] = () =>
      json(
        projection({
          debtsUsd: 10_150.4,
          series: [
            point(0, 22_496, 22_496, { debtBalanceUsd: 10_150.4, netWorthUsd: 12_345.6, realNetWorthUsd: 12_345.6 }),
            point(1, 35_000, 33_296, { debtBalanceUsd: 4_000, netWorthUsd: 31_000, realNetWorthUsd: 31_000 }),
          ],
        }),
      );
    await renderApp();
    nav('Estimate');

    expect(await screen.findByText('Your portfolio')).toBeTruthy();
    expect(screen.getByText('Net worth, after debts')).toBeTruthy();
    expect(screen.getByText('$31,000 net of debts')).toBeTruthy();
    expect(document.querySelectorAll('svg path[stroke-dasharray]')).toHaveLength(1);
  });

  it('draws Estimate as before without debts', async () => {
    await renderApp();
    nav('Estimate');

    expect(await screen.findByText('at this pace')).toBeTruthy();
    expect(document.querySelector('.chart-legend')).toBeNull();
    expect(document.querySelectorAll('svg path[stroke-dasharray]')).toHaveLength(0);
  });

  it("shows each checkpoint's assets and debts in History, and filters the activity by debt", async () => {
    withDebts();
    routes['GET /api/v1/wealth/snapshots'] = () =>
      json([{ ...snapshot('s1', '2026-09-01T12:00:00Z', 9_000, null), assetsUsd: 19_000, debtsUsd: 10_000 }]);
    routes['GET /api/v1/movements'] = () => json({ items: [movement('m3', 'DEBT_PAYMENT', { holding: COINS })], nextCursor: null });
    await renderApp();
    nav('History');

    expect(screen.getByText('Assets $19,000 · Debts $10,000')).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Activity' });
    const [payment] = within(list).getAllByRole('listitem');
    expect(within(payment).getByText('Payment · Visa')).toBeTruthy();
    expect(within(payment).getByText('Sep 20, 2026 · Santander · from Coins')).toBeTruthy();

    const filter = screen.getByLabelText('Filter by asset or debt');
    expect(within(filter).getByRole('option', { name: 'All assets and debts' })).toBeTruthy();
    expect(within(filter).getByRole('option', { name: 'Visa · Santander' })).toBeTruthy();
    expect(within(filter).getByRole('option', { name: 'Mom' })).toBeTruthy();
    fireEvent.change(filter, { target: { value: 'debt:d1' } });
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(2));
    const query = new URL(requests('GET', '/api/v1/movements')[1][0]).searchParams;
    expect(query.get('debtId')).toBe('d1');
    expect(query.get('holdingId')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Debts', pressed: false }));
    await waitFor(() => expect(requests('GET', '/api/v1/movements')).toHaveLength(3));
    expect(new URL(requests('GET', '/api/v1/movements')[2][0]).searchParams.get('kind')).toBe('DEBT_PAYMENT,DEBT_CHARGE,DEBT_INTEREST');
  });
});
