import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, Preferences } from '@/types/wealth';
import { DEFAULT_PREFERENCES } from '@/lib/preferences';
import { HOLDINGS, installFakeBackend, json, nav, newItem, renderApp, requests, routes, snapshot, SNAPSHOTS } from './harness';

// F7: the privacy mode, New ▾ and the keyboard shortcuts, how the app opens (preferences, the monthly
// checkpoint), exporting, the phone's layout, loading and a view that fails. The backend is faked
// (harness.tsx); the app runs for real.

const estimate = vi.hoisted(() => ({ fails: false }));
// Estimate can be made to fail rendering, to see the rest of the app keep working.
vi.mock('@/components/views/EstimateView', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/views/EstimateView')>();
  return {
    ...real,
    EstimateView: () => {
      if (estimate.fails) throw new Error('boom');
      return <real.EstimateView />;
    },
  };
});

installFakeBackend();

// "Now" is May 1st, after the last checkpoint (Apr 15): this month has none yet.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-01T15:00:00'));
  localStorage.clear();
  estimate.fails = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
const dialog = (name: string) => screen.getByRole('dialog', { name });
const sent = (method: string, path: string) => JSON.parse(String(requests(method, path).at(-1)![1].body));
const prefs = (over: Partial<Preferences>) => () => json({ ...DEFAULT_PREFERENCES, ...over });

const debt = (id: string, name: string, balanceUsd: number): Debt => ({
  id,
  name,
  lender: null,
  kind: 'OTHER',
  balanceUsd,
  interestRatePct: null,
  monthlyPaymentUsd: null,
  dueDay: null,
  notes: null,
  createdAt: '2026-01-10T12:00:00Z',
  updatedAt: '2026-01-10T12:00:00Z',
  payoff: { status: 'NO_PAYMENT', months: null, payoffMonth: null, totalInterestUsd: null },
});

describe('privacy mode', () => {
  it('hides every amount, keeps the percentages, and is remembered on this device', async () => {
    await renderApp();
    expect(screen.getByText('64.8%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    // No digits after a $ anywhere: the hero, the cards, the bars.
    expect(document.body.textContent).not.toMatch(/\$\d/);
    expect(screen.getByText('$•••••')).toBeTruthy();
    expect(screen.getByText('64.8%')).toBeTruthy();
    expect(localStorage.getItem('base.hideAmounts')).toBe('1');

    // Charts too, down to their axes and their names.
    nav('History');
    const axis = document.querySelector('.history-chart .chart-y')!;
    expect([...axis.children].every((label) => label.textContent === '$•••')).toBe(true);
    expect(screen.getByRole('group', { name: /^Net worth from \$••••• to \$••••• over 3 months/ })).toBeTruthy();

    // What's typed into a field is shown as it's read.
    newItem('Asset');
    fireEvent.change(within(dialog('Add an asset')).getByPlaceholderText('0.00'), { target: { value: '1.500' } });
    expect(within(dialog('Add an asset')).getByText('= $1,500.00')).toBeTruthy();
    fireEvent.click(within(dialog('Add an asset')).getByRole('button', { name: 'Cancel' }));

    // Opened again on this device: still hidden. H shows them.
    cleanup();
    await renderApp(undefined, '$•••••');
    expect(screen.getByRole('button', { name: 'Show amounts' })).toBeTruthy();
    press('h');
    expect(screen.getByText('$12,346')).toBeTruthy();
    expect(localStorage.getItem('base.hideAmounts')).toBeNull();
  });

  it('follows another tab', async () => {
    await renderApp();
    localStorage.setItem('base.hideAmounts', '1');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'base.hideAmounts', newValue: '1' })));
    expect(screen.queryByText('$12,346')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show amounts' })).toBeTruthy();
  });
});

describe('New ▾', () => {
  it('lists what can be added or recorded, with its key, moving with the arrows', async () => {
    await renderApp();
    const button = screen.getByRole('button', { name: 'New' });
    fireEvent.click(button);
    const menu = screen.getByRole('menu', { name: 'New' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => [i.textContent, i.getAttribute('aria-keyshortcuts')])).toEqual([
      ['AssetN', 'N'],
      ['Gain or lossG', 'G'],
      ['TransferT', 'T'],
      ['DebtD', 'D'],
      ['Debt payment', null],
      ['CheckpointS', 'S'],
      ['Keyboard shortcuts?', '?'],
    ]);
    // Without debts, there's nothing to pay: skipped by the arrows.
    expect((items[4] as HTMLButtonElement).disabled).toBe(true);
    expect(items[4].getAttribute('title')).toBe('No debts yet');

    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[6]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[5]);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'x' });
    expect(document.activeElement).toBe(items[0]);

    // Escape closes it, back on New; so does a click elsewhere, or Tab.
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('asks which asset for a gain or loss, and which debt for a payment', async () => {
    routes['GET /api/v1/debts'] = () => json([debt('d1', 'Visa', 1_250), debt('d2', 'Car loan', 8_400)]);
    await renderApp();

    newItem('Gain or loss');
    const pick = dialog('Record a gain or loss');
    const select = within(pick).getByLabelText('On which asset?') as HTMLSelectElement;
    // By name.
    expect([...select.options].map((o) => o.textContent)).toEqual(['Coins · Vault · $345.60', 'Gold bar · Vault · $4,000.00', 'SPY · Balanz · $8,000.00']);
    fireEvent.change(select, { target: { value: 'h2' } });
    fireEvent.click(within(pick).getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Gold bar · Vault · worth $4,000.00')).toBeTruthy();
    fireEvent.click(within(dialog('Record a change')).getByRole('button', { name: 'Cancel' }));

    newItem('Debt payment');
    const which = dialog('Pay a debt');
    fireEvent.change(within(which).getByLabelText('Which debt?'), { target: { value: 'd1' } });
    fireEvent.click(within(which).getByRole('button', { name: 'Continue' }));
    expect(dialog('Record a payment')).toBeTruthy();
    expect(screen.getByText('Visa · $1,250.00 left to pay')).toBeTruthy();
    fireEvent.click(within(dialog('Record a payment')).getByRole('button', { name: 'Cancel' }));

    newItem('Debt payment');
    fireEvent.click(within(dialog('Pay a debt')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('goes straight to the only asset or debt, and saves a checkpoint in a click', async () => {
    routes['GET /api/v1/holdings'] = () => json(HOLDINGS.slice(0, 1));
    routes['GET /api/v1/debts'] = () => json([debt('d1', 'Visa', 1_250)]);
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    await renderApp();

    newItem('Gain or loss');
    expect(screen.getByText('SPY · Balanz · worth $8,000.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    newItem('Debt payment');
    expect(dialog('Record a payment')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    newItem('Transfer');
    expect(dialog('Transfer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    newItem('Checkpoint');
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(1);
  });

  it("says why a checkpoint couldn't be saved", async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json({ detail: 'A snapshot already exists' }, 409);
    await renderApp();
    newItem('Checkpoint');
    expect(await screen.findByText('A snapshot already exists')).toBeTruthy();
  });
});

describe('keyboard shortcuts', () => {
  it('open what New ▾ offers, from anywhere', async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    await renderApp();

    press('n');
    expect(dialog('Add an asset')).toBeTruthy();
    // Not while a dialog is open (nor while typing in it).
    press('d');
    expect(screen.queryByRole('dialog', { name: 'Add a debt' })).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });

    press('D');
    expect(dialog('Add a debt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    press('t');
    expect(dialog('Transfer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    press('g');
    expect(dialog('Record a gain or loss')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    press('?');
    const help = dialog('Keyboard shortcuts');
    expect(within(help).getAllByRole('term').map((t) => t.textContent)).toEqual(['N', 'G', 'T', 'D', 'S', '/', 'H', '?']);
    fireEvent.click(within(help).getByRole('button', { name: 'Done' }));

    press('s');
    expect(await screen.findByText('Snapshot saved')).toBeTruthy();

    // "/" goes to the asset search, ready to type in; there, letters are just typed.
    press('/');
    expect(screen.getByRole('heading', { name: 'Assets' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search assets' })));
    press('n');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Nor in a list, where a letter picks an option.
    screen.getByRole('combobox', { name: 'Filter by platform' }).focus();
    press('n');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Nor with Ctrl, ⌘ or Alt, nor held down.
    (document.activeElement as HTMLElement).blur();
    press('n', { ctrlKey: true });
    press('n', { metaKey: true });
    press('n', { altKey: true });
    press('n', { repeat: true });
    press('Enter');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('say what to do first when there is nothing to act on', async () => {
    routes['GET /api/v1/holdings'] = () => json([]);
    await renderApp();
    press('g');
    expect(screen.getByText('Add an asset first: then record its gains and losses.')).toBeTruthy();
    press('t');
    expect(screen.getByText('Add an asset first: then move money between your assets.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    for (const name of ['Gain or loss', 'Transfer']) {
      const item = screen.getByRole('menuitem', { name }) as HTMLButtonElement;
      expect([item.disabled, item.title]).toEqual([true, 'Add an asset first']);
    }
  });
});

describe('preferences', () => {
  it('opens on the view and History period picked, on every device', async () => {
    routes['GET /api/v1/preferences'] = prefs({ defaultView: 'history', historyPeriod: '3M' });
    await renderApp();
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: '3M' }) as HTMLInputElement).checked).toBe(true);
  });

  it('reads what an older API leaves out (or this app does not know) as the defaults', async () => {
    routes['GET /api/v1/preferences'] = () => json({ estimate: DEFAULT_PREFERENCES.estimate, defaultView: 'reports', historyPeriod: 'CUSTOM' });
    await renderApp();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    nav('History');
    expect((screen.getByRole('radio', { name: '1Y' }) as HTMLInputElement).checked).toBe(true);
  });

  it('are set in Settings, and saved at once', async () => {
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    await renderApp();
    nav('Settings');
    const section = screen.getByRole('region', { name: 'Preferences' });

    fireEvent.change(within(section).getByLabelText('Start on'), { target: { value: 'debts' } });
    await waitFor(() => expect(requests('PUT', '/api/v1/preferences')).toHaveLength(1));
    expect(sent('PUT', '/api/v1/preferences')).toEqual({ ...DEFAULT_PREFERENCES, defaultView: 'debts' });
    // It's how the app opens: this visit stays where it is.
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();

    // History's period applies right away too.
    fireEvent.change(within(section).getByLabelText('History period'), { target: { value: 'YTD' } });
    await waitFor(() => expect(requests('PUT', '/api/v1/preferences')).toHaveLength(2));
    expect(sent('PUT', '/api/v1/preferences')).toMatchObject({ defaultView: 'debts', historyPeriod: 'YTD' });
    expect([...(within(section).getByLabelText('History period') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      '1M',
      '3M',
      '6M',
      'This year (YTD)',
      '1Y',
      '3Y',
      'All time',
    ]);

    // Monthly: this month has no checkpoint yet, so one is saved now.
    expect(within(section).getByText('Checkpoints are saved only when you ask.')).toBeTruthy();
    fireEvent.click(within(section).getByRole('radio', { name: 'Monthly' }));
    expect(within(section).getByText('One is saved when you open BASE and the month has none yet.')).toBeTruthy();
    expect(await screen.findByText('Monthly checkpoint saved')).toBeTruthy();
    await waitFor(() => expect(sent('PUT', '/api/v1/preferences')).toMatchObject({ autoSnapshot: 'MONTHLY' }));

    nav('History');
    expect((screen.getByRole('radio', { name: 'YTD' }) as HTMLInputElement).checked).toBe(true);
  });

  it("says so when they couldn't be saved", async () => {
    routes['PUT /api/v1/preferences'] = () => Promise.reject(new TypeError('offline'));
    await renderApp();
    nav('Settings');
    fireEvent.change(screen.getByLabelText('Start on'), { target: { value: 'assets' } });
    expect(await screen.findByText("Couldn't save your settings. They'll be saved with your next change.")).toBeTruthy();
  });
});

describe('monthly checkpoint', () => {
  const monthly = () => (routes['GET /api/v1/preferences'] = prefs({ autoSnapshot: 'MONTHLY' }));

  it("saves this month's when the app opens, once", async () => {
    monthly();
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    await renderApp();
    expect(await screen.findByText('Monthly checkpoint saved')).toBeTruthy();
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(1);
    expect(localStorage.getItem('base.monthlyCheckpoint.u1')).toBe('2026-05');

    // Another tab, or opening it again this month in this browser: nothing more.
    cleanup();
    await renderApp();
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(1);
  });

  it('leaves it be when the month has one, or one is saved meanwhile', async () => {
    monthly();
    routes['GET /api/v1/wealth/snapshots'] = () => json([...SNAPSHOTS, snapshot('s5', '2026-05-01T09:00:00Z', 12_000, 33)]);
    await renderApp();
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(0);
    cleanup();

    // Saved from another device while this one was opening.
    let reads = 0;
    routes['GET /api/v1/wealth/snapshots'] = () =>
      json(++reads === 1 ? SNAPSHOTS : [...SNAPSHOTS, snapshot('s5', '2026-05-01T14:00:00Z', 12_000, 33)]);
    await renderApp();
    await waitFor(() => expect(reads).toBe(2));
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(0);
  });

  it('records nothing with nothing to record', async () => {
    monthly();
    routes['GET /api/v1/holdings'] = () => json([]);
    routes['GET /api/v1/wealth/snapshots'] = () => json([]);
    await renderApp();
    expect(requests('GET', '/api/v1/wealth/snapshots')).toHaveLength(1);
    expect(requests('POST', '/api/v1/wealth/snapshots')).toHaveLength(0);
  });

  it('tries again next time when it fails', async () => {
    monthly();
    routes['POST /api/v1/wealth/snapshots'] = () => Promise.reject(new TypeError('offline'));
    await renderApp();
    expect(await screen.findByText("Couldn't save this month's checkpoint. It'll be tried again next time.")).toBeTruthy();
    expect(localStorage.getItem('base.monthlyCheckpoint.u1')).toBeNull();
  });

  it('works without storage too', async () => {
    monthly();
    routes['POST /api/v1/wealth/snapshots'] = () => Promise.reject(new TypeError('offline'));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await renderApp();
    expect(await screen.findByText("Couldn't save this month's checkpoint. It'll be tried again next time.")).toBeTruthy();
  });
});

describe('your data', () => {
  // What the browser was handed to save (its text read as UTF-8, which drops the BOM).
  const files: { name: string; blob: Blob; text: Promise<string> }[] = [];
  beforeEach(() => {
    files.length = 0;
    let blob: Blob;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => ((blob = b), 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      files.push({ name: this.download, blob, text: blob.text() });
    });
  });

  it('exports everything as JSON: every page of the activity, with when and how', async () => {
    const page = (id: string) => ({ id, kind: 'GAIN', occurredAt: '2026-03-01T12:00:00Z', amountUsd: 1 });
    const pages: Record<string, unknown> = {
      '': { items: [page('m3'), page('m2')], nextCursor: 'c1' },
      c1: { items: [page('m1')], nextCursor: null },
    };
    await renderApp();
    // A page at a time, from where the last one ended.
    routes['GET /api/v1/movements'] = () => {
      const url = new URL(String(requests('GET', '/api/v1/movements').at(-1)![0]));
      return json(pages[url.searchParams.get('cursor') ?? '']);
    };
    nav('Settings');

    fireEvent.click(screen.getByRole('button', { name: 'Export everything (JSON)' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeTruthy();
    expect(await screen.findByText('Downloaded base-export-2026-05-01.json')).toBeTruthy();
    const [file] = files;
    expect(file.name).toBe('base-export-2026-05-01.json');
    const exported = JSON.parse(await file.text);
    expect(exported).toMatchObject({ format: 'base-wealth-export', version: 1, exportedAt: new Date('2026-05-01T15:00:00').toISOString() });
    expect(exported.movements.map((m: { id: string }) => m.id)).toEqual(['m3', 'm2', 'm1']);
    expect(exported.holdings).toHaveLength(3);
    expect(exported.snapshots).toHaveLength(4);
    expect(exported.assetClasses.map((c: { name: string }) => c.name)).toEqual(['Cash', 'Equity', 'Gold']);
    expect(exported.platforms).toHaveLength(3);
    expect(exported.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(exported.debts).toEqual([]);
    expect(new URL(String(requests('GET', '/api/v1/movements').at(-1)![0])).searchParams.get('limit')).toBe('200');
  });

  it('exports a list as CSV, for a spreadsheet', async () => {
    await renderApp();
    nav('Settings');
    fireEvent.click(screen.getByRole('button', { name: 'Assets (CSV)' }));
    expect(await screen.findByText('Downloaded base-assets-2026-05-01.csv')).toBeTruthy();
    // UTF-8 with a BOM, for Excel.
    expect([...new Uint8Array(await files[0].blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(files[0].blob.type).toBe('text/csv;charset=utf-8');
    const csv = await files[0].text;
    expect(csv.split('\r\n')).toEqual([
      'Name,Class,Platform,Value (USD),Expected return (% a year),Return counted (% a year),Added,Updated',
      'SPY,Equity,Balanz,8000,8,8,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z',
      'Gold bar,Gold,Vault,4000,,,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z',
      'Coins,Gold,Vault,345.6,,,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z',
      '',
    ]);

    for (const [label, name] of [
      ['Debts (CSV)', 'base-debts-2026-05-01.csv'],
      ['Activity (CSV)', 'base-activity-2026-05-01.csv'],
      ['Checkpoints (CSV)', 'base-checkpoints-2026-05-01.csv'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(await screen.findByText(`Downloaded ${name}`)).toBeTruthy();
    }
    expect(files.map((f) => f.name)).toEqual([
      'base-assets-2026-05-01.csv',
      'base-debts-2026-05-01.csv',
      'base-activity-2026-05-01.csv',
      'base-checkpoints-2026-05-01.csv',
    ]);
    expect((await files[3].text).split('\r\n')[1]).toBe('2026-01-15T12:00:00Z,10000,10000,0,No,');
  });

  it("says why it couldn't export", async () => {
    await renderApp();
    routes['GET /api/v1/wealth/snapshots'] = () => Promise.reject(new TypeError('offline'));
    nav('Settings');
    fireEvent.click(screen.getByRole('button', { name: 'Checkpoints (CSV)' }));
    expect(await screen.findByText("Couldn't export your data. Please try again.")).toBeTruthy();
    expect(files).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Checkpoints (CSV)' })).toBeTruthy();
  });
});

describe('on a phone', () => {
  // A window at most 900 px wide; `resize` makes it wider.
  const phone = () => {
    const listeners = new Set<() => void>();
    const list = {
      matches: true,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', () => list);
    return {
      resize: (narrow: boolean) => {
        list.matches = narrow;
        act(() => listeners.forEach((listener) => listener()));
      },
    };
  };

  it('navigates from a bar along the bottom, with the rest under More', async () => {
    const screenSize = phone();
    await renderApp();
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Dashboard', 'Assets', 'Debts', 'History', 'More']);
    expect(within(bar).getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
    // No sidebar.
    expect(screen.queryByRole('button', { name: /Ana Pérez/ })).toBeNull();

    fireEvent.click(within(bar).getByRole('button', { name: 'Debts' }));
    expect(screen.getByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Debts' }).getAttribute('aria-current')).toBe('page');

    fireEvent.click(within(bar).getByRole('button', { name: 'More' }));
    const more = dialog('More');
    expect(within(more).getAllByRole('button').map((b) => b.textContent)).toEqual(['Platforms', 'Estimate', 'Settings', 'AAna PérezProfile and sign out']);
    fireEvent.click(within(more).getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'More' }).className).toContain('bottom-nav-item-in');

    fireEvent.click(within(bar).getByRole('button', { name: 'More' }));
    expect(within(dialog('More')).getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(dialog('More')).getByRole('button', { name: /Profile and sign out/ }));
    expect(dialog('Profile')).toBeTruthy();
    fireEvent.keyDown(dialog('Profile'), { key: 'Escape' });

    // Wider again: the sidebar is back.
    screenSize.resize(false);
    expect(screen.getByRole('button', { name: /Ana Pérez/ })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('loading and failing', () => {
  it('shows the shape of the app while loading', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const holdings = routes['GET /api/v1/holdings'];
    routes['GET /api/v1/holdings'] = async (init) => {
      await gate;
      return holdings(init);
    };
    const pending = renderApp();
    const status = await screen.findByText('Loading your data…');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.closest('[aria-busy="true"]')).toBeTruthy();
    release();
    await pending;
    expect(screen.queryByText('Loading your data…')).toBeNull();
  });

  it('keeps the app working when a view fails, and reloads it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    estimate.fails = true;
    await renderApp();
    nav('Estimate');
    const failed = () => screen.getByText('Something went wrong in this view').closest('[role="alert"]') as HTMLElement;
    expect(failed()).toBeTruthy();
    // The navigation still works.
    nav('Dashboard');
    expect(screen.getByText('$12,346')).toBeTruthy();
    nav('Estimate');
    estimate.fails = false;
    const reads = requests('GET', '/api/v1/holdings').length;
    fireEvent.click(within(failed()).getByRole('button', { name: 'Reload' }));
    expect(await screen.findByText('$25,000')).toBeTruthy();
    await waitFor(() => expect(requests('GET', '/api/v1/holdings').length).toBe(reads + 1));
  });

  it('marks the view on screen in the navigation, and names the charts by what they show', async () => {
    await renderApp();
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(sidebar).getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
    expect(within(sidebar).getByRole('button', { name: 'Assets' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('img', { name: 'Your assets by class: Equity 64.8%, Gold 35.2%' })).toBeTruthy();
    nav('Estimate');
    expect(await screen.findByRole('group', { name: 'Portfolio from $12,346 now to $25,000 in 1 year. Use the arrow keys to read each year.' })).toBeTruthy();
  });
});
