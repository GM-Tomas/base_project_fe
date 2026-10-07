import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkpointInstant } from '@/components/history/PastCheckpointDialog';
import { breakdownRows } from '@/components/history/ChangeBreakdown';
import {
  installFakeBackend,
  json,
  movementsSummary,
  nav,
  renderApp,
  requests,
  routes,
  snapshot,
  SNAPSHOTS,
  tab,
} from './harness';

// F6: History by periods of analysis: the period picked, its chart, figures and why it changed, checkpoints
// from the past, and the reminder to save one. The backend is faked (harness.tsx); the app runs for real.

installFakeBackend();

// "Now" is a couple of weeks after the last checkpoint (Apr 15), in the user's time zone. The net worth
// today is $12,345.60.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-01T15:00:00'));
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
// The checkpoints in the table (its tab), by their day.
const rows = () => {
  tab('Checkpoints');
  return screen.queryAllByRole('button', { name: /^Delete checkpoint of / }).map((b) => b.getAttribute('aria-label')!.replace('Delete checkpoint of ', ''));
};
const lastQuery = (path: string) => new URL(requests('GET', path).at(-1)![0]).searchParams;
// A figure's value and the line under it (in Overview).
const stat = (label: string) => {
  tab('Overview');
  const tile = within(screen.getByRole('group', { name: 'This period in figures' })).getByText(label).parentElement!;
  return [tile.querySelector('.stat-value')!.textContent, tile.querySelector('.stat-sub')!.textContent];
};
const plot = () => screen.getByRole('group', { name: /Use the arrow keys to read each point\.$/ });
const tooltip = () =>
  [...plot().querySelectorAll('.chart-tooltip > div')].map((d) => [...d.childNodes].map((c) => c.textContent).join(' '));

describe('periods', () => {
  it('picks a period: the table, the figures and the activity follow it', async () => {
    await renderApp();
    nav('History');

    // A year by default: the four checkpoints, then today's value.
    expect(radio('1Y').checked).toBe(true);
    expect(rows()).toEqual(['Jan 15, 2026', 'Feb 15, 2026', 'Mar 15, 2026', 'Apr 15, 2026']);
    expect(stat('Change')).toEqual(['+$2,346 (+23.5%)', 'From $10,000 on Jan 15, 2026 to $12,346 today']);
    expect(screen.getByText('Start: $10,000 on Jan 15, 2026')).toBeTruthy();
    tab('Activity');
    await waitFor(() => expect(new Date(lastQuery('/api/v1/movements').get('from')!)).toEqual(new Date(2025, 4, 1)));
    expect(lastQuery('/api/v1/movements').get('to')).toBeNull();

    // The last month: measured from the last checkpoint before it began.
    fireEvent.click(radio('1M'));
    expect(rows()).toEqual(['Apr 15, 2026']);
    expect(stat('Change')).toEqual(['+$1,346 (+12.2%)', 'From $11,000 on Mar 15, 2026 to $12,346 today']);
    expect(screen.getByText('Start: $11,000 on Mar 15, 2026')).toBeTruthy();
    expect(stat('Annualized change')).toEqual(['—', 'Needs 90 days or more, from above zero']);
    tab('Activity');
    await waitFor(() => expect(new Date(lastQuery('/api/v1/movements').get('from')!)).toEqual(new Date(2026, 3, 1)));
    await waitFor(() => expect(lastQuery('/api/v1/movements/summary').get('from')).toBe('2026-03-15T12:00:00.000Z'));
    expect(new Date(lastQuery('/api/v1/movements/summary').get('to')!)).toEqual(new Date('2026-05-01T15:00:00'));

    fireEvent.click(radio('3M'));
    expect(rows()).toEqual(['Feb 15, 2026', 'Mar 15, 2026', 'Apr 15, 2026']);
    expect(stat('Change')[1]).toBe('From $10,000 on Jan 15, 2026 to $12,346 today');

    // This year: nothing before Jan 1st, so from its first checkpoint.
    fireEvent.click(radio('YTD'));
    expect(rows()).toHaveLength(4);
    expect(stat('Change')[1]).toBe('From $10,000 on Jan 15, 2026 to $12,346 today');
    tab('Activity');
    await waitFor(() => expect(new Date(lastQuery('/api/v1/movements').get('from')!)).toEqual(new Date(2026, 0, 1)));

    fireEvent.click(radio('All'));
    expect(rows()).toHaveLength(4);
    tab('Activity');
    await waitFor(() => expect(lastQuery('/api/v1/movements').get('from')).toBeNull());
  });

  it('takes a custom period, checked, and keeps it while the app is open', async () => {
    await renderApp();
    nav('History');
    fireEvent.click(radio('Custom'));

    // It starts as what was shown: the last year, until today (so today's value can be in).
    const from = () => screen.getByLabelText('From') as HTMLInputElement;
    const to = () => screen.getByLabelText('To') as HTMLInputElement;
    expect([from().value, to().value]).toEqual(['2025-05-01', '2026-05-01']);
    expect(screen.getByLabelText("Include today's value")).toBeTruthy();

    // Ending before today: no today's value, and the activity up to the end of its last day.
    fireEvent.change(to(), { target: { value: '2026-03-31' } });
    expect(rows()).toEqual(['Jan 15, 2026', 'Feb 15, 2026', 'Mar 15, 2026']);
    expect(screen.queryByLabelText("Include today's value")).toBeNull();
    expect(stat('Change')).toEqual(['+$1,000 (+10.0%)', 'From $10,000 on Jan 15, 2026 to $11,000 on Mar 15, 2026']);
    tab('Activity');
    await waitFor(() => expect(new Date(lastQuery('/api/v1/movements').get('to')!)).toEqual(new Date(2026, 2, 31, 23, 59, 59, 999)));

    // Dates that make no period show all time, saying why.
    fireEvent.change(from(), { target: { value: '2026-04-01' } });
    expect(screen.getByText("The end can't be before the start: showing all time.")).toBeTruthy();
    expect(rows()).toHaveLength(4);
    fireEvent.change(to(), { target: { value: '' } });
    expect(screen.getByText('Pick both dates: showing all time.')).toBeTruthy();
    fireEvent.change(to(), { target: { value: '2026-05-02' } });
    expect(screen.getByText("The end can't be in the future: showing all time.")).toBeTruthy();

    // A period with nothing in it, nor before it.
    fireEvent.change(from(), { target: { value: '2025-01-01' } });
    fireEvent.change(to(), { target: { value: '2025-06-30' } });
    expect(screen.getByText('No checkpoints in this period')).toBeTruthy();
    expect(screen.getByText('Pick a longer period.')).toBeTruthy();

    // Kept when leaving History, and when trying another preset and coming back to it.
    fireEvent.change(from(), { target: { value: '2026-02-01' } });
    fireEvent.change(to(), { target: { value: '2026-04-30' } });
    nav('Dashboard');
    nav('History');
    expect(radio('Custom').checked).toBe(true);
    fireEvent.click(radio('1M'));
    fireEvent.click(radio('Custom'));
    expect([from().value, to().value]).toEqual(['2026-02-01', '2026-04-30']);
    expect(rows()).toEqual(['Feb 15, 2026', 'Mar 15, 2026', 'Apr 15, 2026']);
  });

  it("leaves today's value out when asked", async () => {
    await renderApp();
    nav('History');
    fireEvent.click(screen.getByLabelText("Include today's value"));

    expect(stat('Change')).toEqual(['−$1,000 (−10.0%)', 'From $10,000 on Jan 15, 2026 to $9,000 on Apr 15, 2026']);
    fireEvent.focus(plot());
    expect(tooltip()[0]).toBe('Apr 15, 2026');
    expect(plot().querySelector('.chart-dot-today')).toBeNull();
  });

  it('says when a period has no checkpoints, and shows all time in one click', async () => {
    vi.setSystemTime(new Date('2026-10-05T15:00:00'));
    await renderApp();
    nav('History');
    fireEvent.click(radio('1M'));

    expect(screen.getByText('No checkpoints in this period')).toBeTruthy();
    expect(screen.getByText('It went from $9,000 to $12,346.')).toBeTruthy();
    // Still measured: from the last checkpoint before it, to today.
    expect(stat('Change')[0]).toBe('+$3,346 (+37.2%)');

    fireEvent.click(screen.getByRole('button', { name: 'Show all time' }));
    expect(radio('All').checked).toBe(true);
    expect(rows()).toHaveLength(4);
  });
});

describe("a period's figures", () => {
  it('reads the change, annualized, the high and low, the worst drop and the best and worst stretches', async () => {
    await renderApp();
    nav('History');

    expect(stat('Annualized change')[0]).toMatch(/^\+\d+\.\d% a year$/);
    expect(stat('Annualized change')[1]).toBe('Includes what you saved, not just returns');
    expect(stat('High')).toEqual(['$12,346', 'today']);
    expect(stat('Low')).toEqual(['$9,000', 'Apr 15, 2026']);
    expect(stat('Biggest drop')).toEqual(['−$2,000 (−18.2%)', 'From the high of Feb 15, 2026 to Apr 15, 2026']);
    expect(stat('Best stretch')).toEqual(['+$3,346 (+37.2%)', 'Apr 15, 2026 → today']);
    expect(stat('Worst stretch')).toEqual(['−$2,000 (−18.2%)', 'Mar 15, 2026 → Apr 15, 2026']);
  });

  it('has nothing to say about drops that never happened, nor a % from zero', async () => {
    routes['GET /api/v1/wealth/snapshots'] = () =>
      json([snapshot('s1', '2026-01-15T12:00:00Z', 0, null), snapshot('s2', '2026-02-15T12:00:00Z', 11_000, null)]);
    await renderApp();
    nav('History');

    expect(stat('Change')[0]).toBe('+$12,346');
    expect(stat('Annualized change')).toEqual(['—', 'Needs 90 days or more, from above zero']);
    expect(stat('Biggest drop')).toEqual(['None', 'It never fell from a high']);
    expect(stat('Worst stretch')).toEqual(['—', 'No fall between two checkpoints']);
    expect(stat('Best stretch')).toEqual(['+$11,000', 'Jan 15, 2026 → Feb 15, 2026']);
  });

  it('marks checkpoints added by hand, on the chart and in the table, and reads what they were made of', async () => {
    routes['GET /api/v1/wealth/snapshots'] = () =>
      json([
        SNAPSHOTS[0],
        snapshot('s2', '2026-02-15T12:00:00Z', 11_000, 10, { source: 'MANUAL', note: 'From my spreadsheet', assetsUsd: 15_000, debtsUsd: 4_000 }),
        ...SNAPSHOTS.slice(2),
      ]);
    await renderApp();
    nav('History');

    fireEvent.focus(plot());
    fireEvent.keyDown(plot(), { key: 'Home' });
    fireEvent.keyDown(plot(), { key: 'ArrowRight' });
    expect(tooltip()).toEqual([
      'Feb 15, 2026 · added by hand',
      'Net worth $11,000',
      'Assets $15,000',
      'Debts $4,000',
      'Since Jan 15, 2026 +$1,000',
    ]);
    expect(plot().querySelectorAll('.chart-dot-manual')).toHaveLength(1);
    expect(plot().querySelectorAll('.chart-dot-today')).toHaveLength(1);

    tab('Checkpoints');
    const row = screen.getByRole('button', { name: 'Delete checkpoint of Feb 15, 2026' }).closest('tr')!;
    expect(within(row).getByRole('img', { name: 'Added by hand' })).toBeTruthy();
    expect(within(row).getByText('From my spreadsheet')).toBeTruthy();
    expect(within(row).getByText('Assets $15,000 · Debts $4,000')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Added by hand' })).toHaveLength(1);
  });
});

describe('why it changed', () => {
  it("splits the period's change by why, with what nothing recorded explains", async () => {
    routes['GET /api/v1/movements/summary'] = () =>
      json(movementsSummary({ count: 7, transfers: 2, netWorthEffectUsd: { investments: 1_200, saving: 900, addedRemoved: 0, corrections: -50 } }));
    await renderApp();
    nav('History');

    const bars = await screen.findByRole('list', { name: 'Why it changed, by reason' });
    const read = within(bars)
      .getAllByRole('listitem')
      .map((r) => [r.querySelector('.breakdown-label')!.textContent, r.querySelector('.breakdown-amount')!.textContent]);
    expect(read).toEqual([
      ['Investments', '+$1,200'],
      ['Saving', '+$900'],
      ['Added & removed', '$0'],
      ['Corrections', '−$50'],
      ['Not recorded', '+$296'],
    ]);
    // Each bar as long as its share of the largest, up or down.
    const widths = [...bars.querySelectorAll<HTMLElement>('.breakdown-bar')].map((b) => [b.className, b.style.width]);
    expect(widths[0]).toEqual(['breakdown-bar breakdown-up', '100%']);
    expect(widths[3][0]).toBe('breakdown-bar breakdown-down');
    expect(screen.getByText('From 7 recorded changes. 2 transfers moved money between what you own and owe without changing it.')).toBeTruthy();
    // Between the period's start and end.
    expect(lastQuery('/api/v1/movements/summary').get('from')).toBe('2026-01-15T12:00:00.000Z');
  });

  it('says when nothing was recorded, retries when it fails, and asks again after a change', async () => {
    let calls = 0;
    routes['GET /api/v1/movements/summary'] = () =>
      ++calls === 1 ? Promise.reject(new TypeError('offline')) : json(movementsSummary({ count: 1, transfers: 1 }));
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    await renderApp();
    nav('History');

    expect(await screen.findByText("Couldn't work out why it changed. Please try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText('From 1 recorded change. 1 transfer moved money between what you own and owe without changing it.'),
    ).toBeTruthy();

    routes['GET /api/v1/movements/summary'] = () => json(movementsSummary());
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot' }));
    expect(await screen.findByText('Nothing was recorded in this period: all of the change is in "Not recorded".')).toBeTruthy();
  });

  it('works out what nothing recorded explains', () => {
    const split = breakdownRows(100.25, movementsSummary({ netWorthEffectUsd: { investments: 50, saving: 25.5, addedRemoved: -10, corrections: 0.5 } }));
    expect(split.map((r) => [r.label, r.usd])).toEqual([
      ['Investments', 50],
      ['Saving', 25.5],
      ['Added & removed', -10],
      ['Corrections', 0.5],
      ['Not recorded', 34.25],
    ]);
  });
});

describe('past checkpoints', () => {
  const open = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add a past checkpoint' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a past checkpoint' });
    const fill = (label: string, value: string) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    const save = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Add checkpoint' }));
    return { dialog, fill, save };
  };
  const sent = () => JSON.parse(requests('POST', '/api/v1/wealth/snapshots')[0][1].body);

  it('adds one from before BASE: the day and the net worth, then it shows as added by hand', async () => {
    const saved = snapshot('s0', '2025-12-31T12:00:00Z', -2_500, null, { source: 'MANUAL', note: 'From my spreadsheet', assetsUsd: 0, debtsUsd: 2_500 });
    routes['POST /api/v1/wealth/snapshots'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json([saved, ...SNAPSHOTS]);
      return json(saved, 201);
    };
    await renderApp();
    nav('History');
    const { dialog, fill, save } = open();

    save();
    expect(within(dialog).getByText('Please pick the date')).toBeTruthy();
    fill('Date', '2026-05-02');
    save();
    expect(within(dialog).getByText("The date can't be in the future")).toBeTruthy();
    fill('Date', '2025-12-31');
    save();
    expect(within(dialog).getByText('Please enter your net worth then')).toBeTruthy();
    // Below zero is fine: more owed than owned.
    fill('Net worth then (USD)', '-2.500');
    expect(within(dialog).getByText('= -$2,500.00')).toBeTruthy();
    fill('Note (optional)', 'x'.repeat(201));
    save();
    expect(within(dialog).getByText('Keep the note under 200 characters')).toBeTruthy();
    fill('Note (optional)', '  From my spreadsheet  ');
    save();

    expect(await screen.findByText('Checkpoint of Dec 31, 2025 added')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent()).toEqual({ capturedAt: new Date(2025, 11, 31, 12).toISOString(), totalValueUsd: -2_500, note: 'From my spreadsheet' });

    await waitFor(() => expect(rows()[0]).toBe('Dec 31, 2025'));
    const row = screen.getByRole('button', { name: 'Delete checkpoint of Dec 31, 2025' }).closest('tr')!;
    expect(within(row).getByRole('img', { name: 'Added by hand' })).toBeTruthy();
    expect(within(row).getByText('From my spreadsheet')).toBeTruthy();
    expect(within(row).getByText('Assets $0 · Debts $2,500')).toBeTruthy();
  });

  it('works out the net worth from what was owned and owed', async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json(snapshot('s0', '2025-12-31T12:00:00Z', 81_000, null), 201);
    await renderApp();
    nav('History');
    const { dialog, fill, save } = open();

    fill('Date', '2025-12-31');
    fireEvent.click(within(dialog).getByLabelText('I know what I owned and owed'));
    expect(within(dialog).queryByLabelText('Net worth then (USD)')).toBeNull();
    expect(within(dialog).getByText('Net worth: —')).toBeTruthy();
    fill('What you owned (USD)', '95,000');
    save();
    expect(within(dialog).getByText('Please enter what you owned and what you owed')).toBeTruthy();
    fill('What you owed (USD)', 'lots');
    save();
    // The field says it, and so does the form.
    expect(within(dialog).getAllByText('Enter an amount like 1,234.56')).toHaveLength(2);
    fill('What you owed (USD)', '14.000');
    expect(within(dialog).getByText('Net worth: $81,000.00')).toBeTruthy();
    save();

    expect(await screen.findByText('Checkpoint of Dec 31, 2025 added')).toBeTruthy();
    expect(sent()).toEqual({ capturedAt: new Date(2025, 11, 31, 12).toISOString(), totalValueUsd: 81_000, assetsUsd: 95_000, debtsUsd: 14_000 });
  });

  it("keeps the dialog open with the API's reason when it can't be added", async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json({ detail: 'A snapshot already exists for 2025-12-31T12:00:00Z' }, 409);
    await renderApp();
    nav('History');
    const { dialog, fill, save } = open();
    fill('Date', '2025-12-31');
    fill('Net worth then (USD)', '81000');
    save();

    expect(await within(dialog).findByText('A snapshot already exists for 2025-12-31T12:00:00Z')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add checkpoint' })).toBeTruthy();
  });

  it("is taken at noon of the day picked, or now when that's later today", () => {
    expect(checkpointInstant('2025-12-31', new Date(2026, 4, 1, 15))).toBe(new Date(2025, 11, 31, 12).toISOString());
    expect(checkpointInstant('2026-05-01', new Date(2026, 4, 1, 15))).toBe(new Date(2026, 4, 1, 12).toISOString());
    expect(checkpointInstant('2026-05-01', new Date(2026, 4, 1, 9, 30))).toBe(new Date(2026, 4, 1, 9, 30).toISOString());
  });
});

describe('reminder to save a checkpoint', () => {
  const REMINDER = "It's been 35 days since your last checkpoint.";
  // Five weeks after the last checkpoint.
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-20T10:00:00'));
  });

  it('nudges on the dashboard after a month without one, and saves one in a click', async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json([...SNAPSHOTS, snapshot('s5', new Date().toISOString(), 12_345.6, 37.2)]);
      return json({}, 201);
    };
    await renderApp();

    const reminder = screen.getByText(REMINDER).parentElement!;
    fireEvent.click(within(reminder).getByRole('button', { name: 'Save a snapshot' }));
    expect(within(reminder).getByRole('button', { name: 'Saving…' })).toBeTruthy();
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(REMINDER)).toBeNull());
  });

  it("says why it couldn't save one", async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json({ detail: 'A snapshot already exists' }, 409);
    await renderApp();
    fireEvent.click(within(screen.getByText(REMINDER).parentElement!).getByRole('button', { name: 'Save a snapshot' }));
    expect(await screen.findByText('A snapshot already exists')).toBeTruthy();
    expect(screen.getByText(REMINDER)).toBeTruthy();
  });

  it("is the dashboard's only: History has its own button to save one", async () => {
    await renderApp();
    nav('History');
    expect(screen.queryByText(REMINDER)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Save a snapshot' })).toHaveLength(1);
  });

  it('hides until tomorrow once dismissed', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(REMINDER)).toBeNull();
    expect(localStorage.getItem('base.snapshotReminder.dismissedOn')).toBe('2026-05-20');
    nav('History');
    expect(screen.queryByText(REMINDER)).toBeNull();

    cleanup();
    await renderApp();
    expect(screen.queryByText(REMINDER)).toBeNull();

    cleanup();
    vi.setSystemTime(new Date('2026-05-21T10:00:00'));
    await renderApp();
    expect(screen.getByText("It's been 36 days since your last checkpoint.")).toBeTruthy();
  });

  it('still works when the browser keeps nothing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(REMINDER)).toBeNull();
  });

  it('asks for a first checkpoint once there is something to record', async () => {
    routes['GET /api/v1/wealth/snapshots'] = () => json([]);
    await renderApp();
    expect(screen.getByText('Save your first checkpoint to start your history.')).toBeTruthy();

    cleanup();
    routes['GET /api/v1/holdings'] = () => json([]);
    await renderApp();
    expect(screen.queryByText('Save your first checkpoint to start your history.')).toBeNull();
  });
});
