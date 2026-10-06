import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import HomePage from '@/app/page';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useWealth, WealthProvider } from '@/context/WealthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Holding, WealthSummary } from '@/types/wealth';
import {
  authListener,
  fetchMock,
  holding,
  HOLDINGS,
  installFakeBackend,
  json,
  nav,
  newItem,
  PLATFORMS,
  projection,
  renderApp,
  requests,
  routes,
  SESSION,
  snapshot,
  SNAPSHOTS,
  summary,
} from './harness';

installFakeBackend();

// Pinned a couple of weeks after the last checkpoint (no reminder to save one; History's 1Y has them all).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-01T15:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('auth', () => {
  it('renders nothing while the session is loading', () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('signs in with email and password, showing the error on failure', async () => {
    const { container } = await renderApp(null);
    await screen.findByText('Sign in to see your full financial picture.');

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } } as never);
    fireEvent.change(container.querySelector('input[type=email]')!, { target: { value: 'ana@example.com' } });
    fireEvent.change(container.querySelector('input[type=password]')!, { target: { value: 'secret' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'secret' });

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ error: null } as never);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.queryByText('Invalid login credentials')).toBeNull());

    act(() => authListener('SIGNED_IN', SESSION));
    expect(await screen.findByText('$12,346')).toBeTruthy();

    // Signing out (from anywhere) drops back to the login screen.
    act(() => authListener('SIGNED_OUT', null));
    expect(await screen.findByText('Sign in to see your full financial picture.')).toBeTruthy();
  });

  it('starts signed out when the stored session cannot be read', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('storage blocked'));
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(await screen.findByText('Sign in to see your full financial picture.')).toBeTruthy();
  });

  it('lets password managers tell accounts apart', async () => {
    const { container } = await renderApp(null);
    await screen.findByText('Sign in to see your full financial picture.');
    expect(container.querySelector('input[type=email]')!.getAttribute('autocomplete')).toBe('username');
    expect(container.querySelector('input[type=password]')!.getAttribute('autocomplete')).toBe('current-password');
  });

  it('lets developers skip login', async () => {
    await renderApp(null);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip login (dev)' }));
    expect(await screen.findByText('$12,346')).toBeTruthy();
    // No user: the sidebar falls back to a generic name, and the profile has nothing to show.
    fireEvent.click(screen.getByRole('button', { name: /Account/ }));
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('hooks throw outside their providers', () => {
    const Auth = () => (useAuth(), null);
    const Wealth = () => (useWealth(), null);
    // Expected throws: keep React/jsdom from dumping them to the console.
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Auth />)).toThrow('useAuth must be used within an AuthProvider');
    expect(() => render(<Wealth />)).toThrow('useWealth must be used within a WealthProvider');
    window.removeEventListener('error', swallow);
  });
});

describe('loading data', () => {
  it('shows a loading state, then the dashboard', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(await screen.findByText('Loading your data…')).toBeTruthy();
    expect(await screen.findByText('$12,346')).toBeTruthy();
    expect(requests('GET', '/api/v1/wealth/summary')[0][1].headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('shows the API error message', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json({ detail: 'Database unavailable' }, 503);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(await screen.findByText("Couldn't load your data: Database unavailable")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('retries in place from the error screen', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json({ detail: 'Database unavailable' }, 503);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    await screen.findByText("Couldn't load your data: Database unavailable");

    routes['GET /api/v1/wealth/summary'] = () => json({ detail: 'Still down' }, 503);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText("Couldn't load your data: Still down")).toBeTruthy();

    routes['GET /api/v1/wealth/summary'] = () => json(summary());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('$12,346')).toBeTruthy();
  });

  it('shows a generic message when the network fails', async () => {
    routes['GET /api/v1/holdings'] = () => Promise.reject(new TypeError('Failed to fetch'));
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(await screen.findByText("Couldn't load your data. Please try again.")).toBeTruthy();
  });

  it('signs out when the backend rejects the token', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json({}, 401);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(await screen.findByText(/Your session expired/)).toBeTruthy();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('dashboard', () => {
  it('shows net worth, liquidity, counts and distributions', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('+12.3% since January')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
    const liquidity = screen.getByText('Ready to spend').parentElement!;
    expect(liquidity.querySelector('.card-body')!.textContent).toBe('Equity you can move quickly · 30% locked in · Change');
    expect(screen.getByText('Across 3 accounts')).toBeTruthy();
    expect(screen.getByText('64.8%')).toBeTruthy();
    expect(screen.getByText('$8,000 · 64.8%')).toBeTruthy();
    // Exposure bars are sorted by balance, largest first.
    const bars = screen.getByText('Where it lives').parentElement!;
    const names = within(bars).getAllByText(/^(Balanz|Vault|Empty)$/);
    expect(names.map((el) => el.lastChild!.textContent)).toEqual(['Balanz', 'Vault', 'Empty']);
    // Each with its thumbnail: its initial, without one of the user's.
    expect(names.map((el) => el.querySelector('.platform-avatar')!.textContent)).toEqual(['B', 'V', 'E']);
  });

  it.each([
    ['EARLIEST_SNAPSHOT', -3.5, '-3.5% since your first snapshot'],
    ['NO_BASELINE', 0, 'No history yet'],
  ] as const)('labels YTD growth for %s', async (basis, growthPct, label) => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ ytd: { basis, growthPct } }));
    await renderApp();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('starts an empty account off with a way to add its first asset', async () => {
    routes['GET /api/v1/holdings'] = () => json([]);
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ byAssetClass: [], byPlatform: [] }));
    await renderApp();
    expect(screen.getByText('Start by adding what you own')).toBeTruthy();
    expect(screen.queryByText("What you're holding")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first asset' }));
    expect(screen.getByRole('dialog', { name: 'Add an asset' })).toBeTruthy();
  });

  it('renders an empty donut with no holdings', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ byAssetClass: [], byPlatform: [] }));
    await renderApp();
    expect(screen.getByText('What you’re holding'.replace('’', "'"))).toBeTruthy();
  });
});

describe('platforms', () => {
  it('drills into a platform and closes again', async () => {
    await renderApp();
    nav('Platforms');
    expect(screen.getByRole('heading', { name: 'Platforms' })).toBeTruthy();

    fireEvent.click(screen.getByText('Vault'));
    expect(screen.getByText("Vault · what's there")).toBeTruthy();
    expect(screen.getByText('Gold bar')).toBeTruthy();
    expect(screen.getByText('Coins')).toBeTruthy();

    fireEvent.click(screen.getByText('Vault'));
    expect(screen.queryByText("Vault · what's there")).toBeNull();

    fireEvent.click(screen.getByText('Empty'));
    expect(screen.getByText('No individual holdings recorded for this platform yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText("Empty · what's there")).toBeNull();

    // Changing view resets the selection.
    fireEvent.click(screen.getByText('Balanz'));
    nav('Dashboard');
    nav('Platforms');
    expect(screen.queryByText("Balanz · what's there")).toBeNull();
  });
});

describe('platforms without assets', () => {
  it('says where platforms come from and how to start', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ byPlatform: [] }));
    await renderApp();
    nav('Platforms');
    expect(screen.getByText('Platforms appear as you add assets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first asset' }));
    expect(screen.getByRole('dialog', { name: 'Add an asset' })).toBeTruthy();
  });
});

describe('platform drill-down across refreshes', () => {
  // A refresh while the drill-down is open: adding an asset from the header.
  const addAsset = async () => {
    newItem('Asset');
    fireEvent.change(screen.getByPlaceholderText('e.g. Vanguard S&P 500 ETF'), { target: { value: 'VOO' } });
    const [platform, assetClass] = screen.getAllByRole('combobox');
    fireEvent.change(platform, { target: { value: 'Balanz' } });
    fireEvent.change(assetClass, { target: { value: 'Equity' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save asset' }).closest('form')!);
    await waitFor(() => expect(screen.queryByText('Save asset')).toBeNull());
  };
  const serve = (holdings: Holding[], byPlatform: WealthSummary['byPlatform']) => {
    routes['GET /api/v1/holdings'] = () => json(holdings);
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ byPlatform }));
  };
  const BALANZ = { name: 'Balanz', type: 'Broker', valueUsd: 8001, pct: 64.8, count: 2, avatarText: null, color: null };
  const VOO = holding('h4', 'VOO', 'Equity', 'Balanz', 1);

  beforeEach(() => {
    routes['POST /api/v1/holdings'] = () => json({}, 201);
  });

  it('follows the selected platform when the API respells it', async () => {
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByText('Vault'));

    serve([...HOLDINGS, VOO], [{ name: 'Vault', type: 'Safe', valueUsd: 4345.6, pct: 35.2, count: 2, avatarText: null, color: null }, BALANZ]);
    await addAsset();
    expect(screen.getByText("Vault · what's there")).toBeTruthy();

    // "Gold bar", the earliest Vault holding, was deleted elsewhere; "Coins" was stored as "vault".
    serve([HOLDINGS[0], { ...HOLDINGS[2], platform: 'vault' }, VOO], [{ name: 'vault', type: 'Safe', valueUsd: 345.6, pct: 4, count: 1, avatarText: null, color: null }, BALANZ]);
    await addAsset();
    expect(await screen.findByText("vault · what's there")).toBeTruthy();
    expect(screen.getByText('Coins')).toBeTruthy();
    expect(screen.queryByText('Gold bar')).toBeNull();
  });

  it('Retry after a failed reload keeps the view and the selected platform', async () => {
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByText('Vault'));

    routes['POST /api/v1/holdings'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json({ detail: 'Service Unavailable' }, 503);
      return json({}, 201);
    };
    await addAsset();
    expect(await screen.findByText("Your change was saved, but your data couldn't be reloaded: Service Unavailable")).toBeTruthy();

    routes['GET /api/v1/wealth/snapshots'] = () => json(SNAPSHOTS);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText("Vault · what's there")).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Platforms' })).toBeTruthy();
    expect(screen.getByText('Gold bar')).toBeTruthy();
  });

  it('closes the drill-down when its platform is gone', async () => {
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByText('Vault'));

    serve([HOLDINGS[0], VOO], [BALANZ]);
    await addAsset();
    await waitFor(() => expect(screen.queryByText("Vault · what's there")).toBeNull());
  });
});

describe('overlapping refreshes', () => {
  it('never shows an older answer over a newer one', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    let wealth!: ReturnType<typeof useWealth>;
    const Probe = () => {
      wealth = useWealth();
      return (
        <p>
          {wealth.holdings.map((h) => h.name).join(', ')} / {wealth.selectedPlatform ?? 'none'}
        </p>
      );
    };
    render(
      <WealthProvider>
        <Probe />
      </WealthProvider>,
    );
    await screen.findByText('SPY, Gold bar, Coins / none');

    // A refresh goes out and its answer is slow…
    let answerOld!: (res: Response) => void;
    routes['GET /api/v1/holdings'] = () => new Promise<Response>((resolve) => (answerOld = resolve));
    let older!: Promise<void>;
    act(() => {
      older = wealth.refresh();
    });
    await waitFor(() => expect(answerOld).toBeTypeOf('function'));

    // …a newer one lands first (a platform added since), and the user opens it…
    routes['GET /api/v1/holdings'] = () => json([...HOLDINGS, holding('h9', 'BTC', 'Crypto', 'Binance', 10)]);
    await act(() => wealth.refresh());
    act(() => wealth.setSelectedPlatform('Binance'));
    expect(screen.getByText('SPY, Gold bar, Coins, BTC / Binance')).toBeTruthy();

    // …then the older answer arrives: dropped, the screen and the selection stay.
    await act(async () => {
      answerOld(json(HOLDINGS));
      await older;
    });
    expect(screen.getByText('SPY, Gold bar, Coins, BTC / Binance')).toBeTruthy();
  });

  it('drops an older answer that arrives after a newer refresh failed', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    let wealth!: ReturnType<typeof useWealth>;
    const Probe = () => {
      wealth = useWealth();
      return <p>{wealth.holdings.map((h) => h.name).join(', ')}</p>;
    };
    render(
      <WealthProvider>
        <Probe />
      </WealthProvider>,
    );
    await screen.findByText('SPY, Gold bar, Coins');

    let answerOld!: (res: Response) => void;
    routes['GET /api/v1/holdings'] = () => new Promise<Response>((resolve) => (answerOld = resolve));
    let older!: Promise<void>;
    act(() => {
      older = wealth.refresh();
    });
    await waitFor(() => expect(answerOld).toBeTypeOf('function'));

    routes['GET /api/v1/holdings'] = () => json(HOLDINGS);
    routes['GET /api/v1/wealth/summary'] = () => json({ detail: 'Service Unavailable' }, 503);
    await act(() => expect(wealth.refresh()).rejects.toThrow('Service Unavailable'));

    // Whatever the newer refresh would have shown, the older answer is from before it.
    await act(async () => {
      answerOld(json([holding('h0', 'Stale', 'Cash', 'Old Bank', 1)]));
      await older;
    });
    expect(screen.getByText('SPY, Gold bar, Coins')).toBeTruthy();
  });

  it('a reload that fails is cleared by an overlapping one that loads', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    let wealth!: ReturnType<typeof useWealth>;
    const Probe = () => {
      wealth = useWealth();
      return <p>{wealth.loadError ?? wealth.holdings.map((h) => h.name).join(', ')}</p>;
    };
    render(
      <WealthProvider>
        <Probe />
      </WealthProvider>,
    );
    await screen.findByText('SPY, Gold bar, Coins');

    // Two deletes in a row: the first one's reload fails, the second one's loads, a moment later.
    routes['DELETE /api/v1/holdings/h1'] = () => new Response(null, { status: 204 });
    routes['DELETE /api/v1/holdings/h2'] = () => new Response(null, { status: 204 });
    let summaries = 0;
    routes['GET /api/v1/wealth/summary'] = () =>
      ++summaries === 1 ? json({ detail: 'Service Unavailable' }, 503) : json(summary());
    let answerLast!: (res: Response) => void;
    let holdingsAsked = 0;
    routes['GET /api/v1/holdings'] = () =>
      ++holdingsAsked === 1 ? json(HOLDINGS) : new Promise<Response>((resolve) => (answerLast = resolve));

    let both!: Promise<unknown>;
    act(() => {
      both = Promise.all([wealth.deleteHolding('h1'), wealth.deleteHolding('h2')]);
    });
    expect(await screen.findByText("Your change was saved, but your data couldn't be reloaded: Service Unavailable")).toBeTruthy();

    await act(async () => {
      answerLast(json([HOLDINGS[2]]));
      await both;
    });
    expect(screen.getByText('Coins')).toBeTruthy();
  });

  it("doesn't report an older refresh failing once newer data is on screen", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    let wealth!: ReturnType<typeof useWealth>;
    const Probe = () => {
      wealth = useWealth();
      return <p>{wealth.holdings.map((h) => h.name).join(', ')}</p>;
    };
    render(
      <WealthProvider>
        <Probe />
      </WealthProvider>,
    );
    await screen.findByText('SPY, Gold bar, Coins');

    let failOld!: (e: Error) => void;
    routes['GET /api/v1/holdings'] = () => new Promise<Response>((_, reject) => (failOld = reject));
    let older!: Promise<void>;
    act(() => {
      older = wealth.refresh();
    });
    await waitFor(() => expect(failOld).toBeTypeOf('function'));

    routes['GET /api/v1/holdings'] = () => json(HOLDINGS.slice(1));
    await act(() => wealth.refresh());
    expect(screen.getByText('Gold bar, Coins')).toBeTruthy();

    await act(async () => {
      failOld(new TypeError('offline'));
      await expect(older).resolves.toBeUndefined();
    });
    expect(screen.getByText('Gold bar, Coins')).toBeTruthy();
  });
});

describe('assets', () => {
  it('filters by asset class', async () => {
    await renderApp();
    nav('Assets');
    expect(screen.getByText('SPY')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    expect(screen.queryByText('SPY')).toBeNull();
    expect(screen.getByText('Gold bar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gold' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
    expect(screen.getByText('No assets match this filter')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText('SPY')).toBeTruthy();
  });

  it('asks before removing a holding, then removes it and says so', async () => {
    routes['DELETE /api/v1/holdings/h1'] = () => {
      routes['GET /api/v1/holdings'] = () => json(HOLDINGS.slice(1));
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('Assets');

    const remove = screen.getByRole('button', { name: 'Remove SPY' });
    remove.focus();
    fireEvent.click(remove);
    const dialog = screen.getByRole('dialog', { name: 'Remove asset?' });
    expect(within(dialog).getByText('SPY on Balanz ($8,000) will stop counting toward your net worth.')).toBeTruthy();
    // Cancel has the focus: Enter doesn't remove anything by accident.
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(remove);
    expect(requests('DELETE', '/api/v1/holdings/h1')).toHaveLength(0);

    fireEvent.click(remove);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    await waitFor(() => expect(screen.queryByText('SPY')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Asset removed')).toBeTruthy();
    expect(requests('DELETE', '/api/v1/holdings/h1')).toHaveLength(1);
  });

  it('says the asset was removed when only reloading afterwards fails', async () => {
    routes['DELETE /api/v1/holdings/h1'] = () => {
      routes['GET /api/v1/holdings'] = () => Promise.reject(new TypeError('offline'));
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Remove SPY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(
      await screen.findByText(
        "Your change was saved, but your data couldn't be reloaded. Please try again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Could not remove this asset. Please try again.')).toBeNull();
  });

  it.each([
    ['an API error', () => json({ detail: 'Holding not found' }, 404), 'Holding not found'],
    ['a network error', () => Promise.reject(new TypeError('offline')), 'Could not remove this asset. Please try again.'],
  ])('keeps the confirmation open with %s', async (_name, route, message) => {
    routes['DELETE /api/v1/holdings/h1'] = route;
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Remove SPY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = screen.getByRole('dialog', { name: 'Remove asset?' });
    expect(await within(dialog).findByText(message)).toBeTruthy();
    // Nothing was removed, and it can be tried again.
    expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(screen.getByText('SPY')).toBeTruthy();
  });

  it('starts an empty account off with a way to add its first asset', async () => {
    routes['GET /api/v1/holdings'] = () => json([]);
    await renderApp();
    nav('Assets');
    expect(screen.getByText('Start by adding what you own')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first asset' }));
    expect(screen.getByRole('dialog', { name: 'Add an asset' })).toBeTruthy();
  });
});

describe('edit asset', () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const save = () => screen.getByRole('button', { name: 'Save changes' });

  it('opens prefilled, saves only what changed and says so', async () => {
    routes['PATCH /api/v1/holdings/h2'] = () => json(holding('h2', 'Gold bar', 'Gold', 'Vault', 20000.5));
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gold bar' }));
    const fill = (label: string, value: string) =>
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(label), { target: { value } });

    const dialog = screen.getByRole('dialog', { name: 'Edit asset' });
    expect((within(dialog).getByLabelText('Name') as HTMLInputElement).value).toBe('Gold bar');
    expect((within(dialog).getByLabelText('Platform') as HTMLInputElement).value).toBe('Vault');
    expect((within(dialog).getByLabelText('Asset class') as HTMLInputElement).value).toBe('Gold');
    expect((within(dialog).getByLabelText('Value (USD)') as HTMLInputElement).value).toBe('4000');
    // Nothing to save until something changes.
    expect(save().hasAttribute('disabled')).toBe(true);
    fill('Name', ' Gold bar ');
    expect(save().hasAttribute('disabled')).toBe(true);

    fill('Value (USD)', '20.000,50');
    expect(save().hasAttribute('disabled')).toBe(false);
    fireEvent.submit(save().closest('form')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(JSON.parse(requests('PATCH', '/api/v1/holdings/h2')[0][1].body)).toEqual({ valueUsd: 20000.5 });
    expect(screen.getByText('Changes saved')).toBeTruthy();
    expect(requests('GET', '/api/v1/holdings')).toHaveLength(2);
  });

  it('moves an asset to another platform and class', async () => {
    routes['PATCH /api/v1/holdings/h1'] = () => json(holding('h1', 'SPY', 'Index Fund', 'Vault', 8000));
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Edit SPY' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit asset' });
    fireEvent.change(within(dialog).getByLabelText('Platform'), { target: { value: 'vault' } });
    expect(within(dialog).getByText('Matches Vault')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Asset class'), { target: { value: 'Index Fund' } });
    fireEvent.submit(save().closest('form')!);

    await waitFor(() => expect(requests('PATCH', '/api/v1/holdings/h1')).toHaveLength(1));
    expect(JSON.parse(requests('PATCH', '/api/v1/holdings/h1')[0][1].body)).toEqual({ platform: 'vault', assetClass: 'Index Fund' });
  });

  it('says what is wrong, and reloads when the asset is gone', async () => {
    routes['PATCH /api/v1/holdings/h1'] = () => json({ detail: 'Holding h1 not found' }, 404);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Edit SPY' }));
    const fill = (label: string, value: string) =>
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(label), { target: { value } });

    fill('Value (USD)', 'lots');
    fireEvent.submit(save().closest('form')!);
    expect(screen.getByText('Enter an amount like 1,234.56', { selector: '.form-error' })).toBeTruthy();
    fill('Name', '');
    fill('Value (USD)', '1');
    fireEvent.submit(save().closest('form')!);
    expect(screen.getByText('Please enter an asset name')).toBeTruthy();
    expect(requests('PATCH', '/api/v1/holdings/h1')).toHaveLength(0);

    // Removed from another device meanwhile: the API says so, and the list is refreshed.
    fill('Name', 'SPY ETF');
    fireEvent.submit(save().closest('form')!);
    expect(await screen.findByText('Holding h1 not found')).toBeTruthy();
    await waitFor(() => expect(requests('GET', '/api/v1/holdings')).toHaveLength(2));
    expect(screen.getByRole('dialog', { name: 'Edit asset' })).toBeTruthy();
  });

  it("edits and removes from a platform's holdings, and adds there", async () => {
    routes['PATCH /api/v1/holdings/h3'] = () => json(holding('h3', 'Coins', 'Gold', 'Vault', 400));
    routes['POST /api/v1/holdings'] = () => json({}, 201);
    await renderApp();
    nav('Platforms');
    fireEvent.click(screen.getByText('Vault'));
    expect(screen.getByText('2 assets · $4,346')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Coins' }));
    fireEvent.change(screen.getByLabelText('Value (USD)'), { target: { value: '400' } });
    fireEvent.submit(save().closest('form')!);
    await waitFor(() => expect(requests('PATCH', '/api/v1/holdings/h3')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Gold bar' }));
    expect(screen.getByRole('dialog', { name: 'Remove asset?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add asset here' }));
    const dialog = screen.getByRole('dialog', { name: 'Add an asset' });
    expect((within(dialog).getByLabelText('Platform') as HTMLInputElement).value).toBe('Vault');
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Name'));
  });
});

describe('assets table', () => {
  const rowNames = () =>
    screen
      .getAllByRole('row')
      .slice(1, -1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);

  it('searches across name, platform and class, ignoring accents', async () => {
    routes['GET /api/v1/holdings'] = () => json([...HOLDINGS, holding('h4', 'Café Martínez', 'Equity', 'Balanz', 100)]);
    await renderApp();
    nav('Assets');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search assets' }), { target: { value: 'cafe' } });
    expect(rowNames()).toEqual(['Café Martínez']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search assets' }), { target: { value: 'VAULT' } });
    expect(rowNames()).toEqual(['Gold bar', 'Coins']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search assets' }), { target: { value: 'gold coi' } });
    expect(rowNames()).toEqual(['Coins']);
  });

  it('combines filters, totals what is shown and starts over with Show all', async () => {
    await renderApp();
    nav('Assets');
    expect(rowNames()).toEqual(['SPY', 'Gold bar', 'Coins']);
    expect(screen.getByText('3 assets · $12,346')).toBeTruthy();
    expect(screen.getByText('64.8%')).toBeTruthy();
    expect(screen.getByText('2.8%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    expect(screen.getByText('2 assets · $4,346 · 35.2% of your assets')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by platform' }), { target: { value: 'Balanz' } });
    expect(screen.getByText('No assets match this filter')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(rowNames()).toEqual(['SPY', 'Gold bar', 'Coins']);
    expect((screen.getByRole('combobox', { name: 'Filter by platform' }) as HTMLSelectElement).value).toBe('All');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by platform' }), { target: { value: 'Vault' } });
    expect(rowNames()).toEqual(['Gold bar', 'Coins']);
    expect(screen.getByText('2 assets · $4,346 · 35.2% of your assets')).toBeTruthy();
  });

  it('sorts by a column, both ways, and says how', async () => {
    await renderApp();
    nav('Assets');
    const header = (name: string) => screen.getByRole('button', { name }).closest('th')!;
    expect(header('Value').getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Value').getAttribute('aria-sort')).toBeNull();
    expect(rowNames()).toEqual(['Coins', 'Gold bar', 'SPY']);

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(header('Name').getAttribute('aria-sort')).toBe('descending');
    expect(rowNames()).toEqual(['SPY', 'Gold bar', 'Coins']);

    fireEvent.click(screen.getByRole('button', { name: 'Value' }));
    expect(rowNames()).toEqual(['SPY', 'Gold bar', 'Coins']);
    fireEvent.click(screen.getByRole('button', { name: 'Value' }));
    expect(rowNames()).toEqual(['Coins', 'Gold bar', 'SPY']);
  });

  it('keeps its search, filters and order while visiting other views', async () => {
    await renderApp();
    nav('Assets');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search assets' }), { target: { value: 'o' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));

    nav('Dashboard');
    nav('Assets');
    expect((screen.getByRole('searchbox', { name: 'Search assets' }) as HTMLInputElement).value).toBe('o');
    expect(screen.getByRole('button', { name: 'Gold' }).getAttribute('aria-pressed')).toBe('true');
    expect(rowNames()).toEqual(['Coins', 'Gold bar']);
  });

  it("forgets a filter on a platform that's gone", async () => {
    await renderApp();
    nav('Assets');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by platform' }), { target: { value: 'Vault' } });
    expect(rowNames()).toEqual(['Gold bar', 'Coins']);

    // Its assets were removed from another device; the next reload no longer has the platform.
    routes['GET /api/v1/platforms'] = () => json(PLATFORMS.filter((p) => p.name !== 'Vault'));
    routes['GET /api/v1/holdings'] = () => json(HOLDINGS.slice(0, 1));
    routes['POST /api/v1/wealth/snapshots'] = () => json({}, 201);
    nav('History');
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot' }));
    await screen.findByText('Snapshot saved');
    nav('Assets');
    expect((screen.getByRole('combobox', { name: 'Filter by platform' }) as HTMLSelectElement).value).toBe('All');
    expect(rowNames()).toEqual(['SPY']);
  });

  it("opens an asset's platform from its row", async () => {
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getAllByRole('button', { name: 'Vault' })[0]);
    expect(screen.getByRole('heading', { name: 'Platforms' })).toBeTruthy();
    expect(screen.getByText("Vault · what's there")).toBeTruthy();
  });
});

describe('delete checkpoint', () => {
  it('asks first, deletes and refreshes', async () => {
    routes['DELETE /api/v1/wealth/snapshots/s2'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json(SNAPSHOTS.filter((s) => s.id !== 's2'));
      return new Response(null, { status: 204 });
    };
    await renderApp();
    nav('History');

    fireEvent.click(screen.getByRole('button', { name: 'Delete checkpoint of Feb 15, 2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete checkpoint?' });
    expect(within(dialog).getByText('The checkpoint of Feb 15, 2026 ($11,000) will be removed from your history.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Feb 15, 2026')).toBeNull());
    expect(screen.getByText('Checkpoint deleted')).toBeTruthy();
    expect(requests('DELETE', '/api/v1/wealth/snapshots/s2')).toHaveLength(1);
  });

  it('keeps the confirmation open when it fails', async () => {
    routes['DELETE /api/v1/wealth/snapshots/s1'] = () => Promise.reject(new TypeError('offline'));
    await renderApp();
    nav('History');
    fireEvent.click(screen.getByRole('button', { name: 'Delete checkpoint of Jan 15, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Could not delete this checkpoint. Please try again.')).toBeTruthy();
    expect(screen.getByText('Jan 15, 2026')).toBeTruthy();
  });
});

describe('history', () => {
  it('lists checkpoints with their change', async () => {
    await renderApp();
    nav('History');
    expect(screen.getByText('Jan 15, 2026')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('▲ +10.0%')).toBeTruthy();
    expect(screen.getByText('– 0.0%')).toBeTruthy();
    expect(screen.getByText('▼ -18.2%')).toBeTruthy();
  });

  it('reads each point on hover and with the arrow keys', async () => {
    await renderApp();
    nav('History');
    // Named by what it shows.
    const plot = screen.getByRole('group', {
      name: 'Net worth from $10,000 to $12,346 over 3 months. Use the arrow keys to read each point.',
    });
    plot.getBoundingClientRect = () => ({ left: 0, width: 680 }) as DOMRect;
    const read = () =>
      [...plot.querySelectorAll('.chart-tooltip > div')].map((d) => [...d.childNodes].map((c) => c.textContent).join(' '));
    const JAN = ['Jan 15, 2026', 'Net worth $10,000'];
    const TODAY = ['Today', 'Net worth $12,346', 'Since Apr 15, 2026 +$3,346'];

    // The point nearest the pointer: the first checkpoint at the left, today's value at the right.
    fireEvent.mouseMove(plot, { clientX: 0 });
    expect(read()).toEqual(JAN);
    fireEvent.mouseMove(plot, { clientX: 680 });
    expect(read()).toEqual(TODAY);
    fireEvent.mouseLeave(plot);
    expect(read()).toEqual([]);

    // With the focus, from the last point; the arrows, Home and End move along.
    fireEvent.focus(plot);
    expect(read()).toEqual(TODAY);
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(read()).toEqual(['Apr 15, 2026', 'Net worth $9,000', 'Since Mar 15, 2026 −$2,000']);
    fireEvent.keyDown(plot, { key: 'Home' });
    expect(read()).toEqual(JAN);
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(read()).toEqual(JAN);
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(read()).toEqual(['Feb 15, 2026', 'Net worth $11,000', 'Since Jan 15, 2026 +$1,000']);
    fireEvent.keyDown(plot, { key: 'End' });
    expect(read()).toEqual(TODAY);
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(read()).toEqual(TODAY);
    fireEvent.keyDown(plot, { key: 'a' });
    expect(read()).toEqual(TODAY);
    fireEvent.blur(plot);
    expect(read()).toEqual([]);
  });

  it('takes a snapshot and refreshes', async () => {
    routes['GET /api/v1/wealth/snapshots'] = () => json([]);
    routes['POST /api/v1/wealth/snapshots'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json([snapshot('s9', '2026-05-01T12:00:00Z', 12345.6, null)]);
      return json({}, 201);
    };
    await renderApp();
    nav('History');
    expect(screen.getByText('No checkpoints yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Delete checkpoint of May 1, 2026' })).toBeTruthy();
    expect(screen.getByText('Snapshot saved')).toBeTruthy();
  });

  it.each([
    ['an API error', () => json({ detail: 'A snapshot already exists' }, 409), 'A snapshot already exists'],
    ['a network error', () => Promise.reject(new TypeError('offline')), 'Could not save a snapshot right now'],
  ])('shows %s when saving a snapshot fails', async (_name, route, message) => {
    routes['POST /api/v1/wealth/snapshots'] = route;
    await renderApp();
    nav('History');
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save a snapshot' })).toBeTruthy();
  });
});

describe('add asset', () => {
  const open = () => newItem('Asset');
  const form = () => screen.getByRole('button', { name: 'Save asset' }).closest('form')!;
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const suggestions = (label: string) =>
    [...document.getElementById(screen.getByLabelText(label).getAttribute('list')!)!.children].map((o) => o.getAttribute('value'));
  const sent = () => JSON.parse(requests('POST', '/api/v1/holdings')[0][1].body);

  it('creates a holding on an existing platform and class', async () => {
    routes['POST /api/v1/holdings'] = () => json({}, 201);
    await renderApp();
    open();
    const dialog = screen.getByRole('dialog', { name: 'Add an asset' });
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Name'));

    fill('Name', '  VOO  ');
    fill('Platform', 'Vault');
    fill('Asset class', 'Equity');
    fill('Value (USD)', '1500.5');
    fireEvent.submit(form());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent()).toEqual({ name: 'VOO', assetClass: 'Equity', platform: 'Vault', valueUsd: 1500.5 });
    expect(screen.getByText('Asset added')).toBeTruthy();
  });

  it('reads amounts as people type them, and shows how', async () => {
    routes['POST /api/v1/holdings'] = () => json({}, 201);
    await renderApp();
    open();
    fill('Name', 'Plazo fijo');
    fill('Platform', 'Vault');
    fill('Asset class', 'Cash');
    fill('Value (USD)', '$ 1.234,56');
    expect(screen.getByText('= $1,234.56')).toBeTruthy();
    fireEvent.submit(form());

    await waitFor(() => expect(requests('POST', '/api/v1/holdings')).toHaveLength(1));
    expect(sent().valueUsd).toBe(1234.56);
  });

  it('says the asset was saved when only reloading afterwards fails', async () => {
    routes['POST /api/v1/holdings'] = () => {
      routes['GET /api/v1/wealth/snapshots'] = () => json({ detail: 'Service Unavailable' }, 503);
      return json({}, 201);
    };
    await renderApp();
    open();
    fill('Name', 'VOO');
    fill('Platform', 'Vault');
    fill('Asset class', 'Equity');
    fill('Value (USD)', '1');
    fireEvent.submit(form());

    expect(
      await screen.findByText(
        "Your change was saved, but your data couldn't be reloaded: Service Unavailable",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Could not save this asset. Please try again.')).toBeNull();
    expect(requests('POST', '/api/v1/holdings')).toHaveLength(1);
  });

  it('suggests what exists and says when a platform or class is new, or which one it matches', async () => {
    routes['POST /api/v1/holdings'] = () => json({}, 201);
    await renderApp();
    open();
    expect(suggestions('Platform')).toEqual(['Balanz', 'Vault', 'Empty']);
    expect(suggestions('Asset class')).toEqual(['Cash', 'Equity', 'Gold']);

    fill('Platform', 'Vault');
    expect(screen.queryByText(/Matches|New platform/)).toBeNull();
    fill('Platform', 'vault');
    expect(screen.getByText('Matches Vault')).toBeTruthy();
    fill('Platform', ' Binance ');
    expect(screen.getByText('New platform — it will be created')).toBeTruthy();

    fill('Asset class', 'Equity');
    expect(screen.queryByText('New class — it will be created')).toBeNull();
    fill('Asset class', ' Crypto ');
    expect(screen.getByText('New class — it will be created')).toBeTruthy();

    fill('Name', 'BTC');
    fill('Value (USD)', '10');
    fireEvent.submit(form());
    await waitFor(() => expect(requests('POST', '/api/v1/holdings')).toHaveLength(1));
    expect(sent()).toMatchObject({ platform: 'Binance', assetClass: 'Crypto' });
  });

  it('starts empty, with nothing to suggest, on a new account', async () => {
    routes['GET /api/v1/platforms'] = () => json([]);
    routes['GET /api/v1/asset-classes'] = () => json({ defaults: [], inUse: [], all: [] });
    await renderApp();
    open();
    for (const label of ['Platform', 'Asset class']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
      expect(suggestions(label)).toEqual([]);
    }
  });

  it('validates before sending, and takes 0 as a value', async () => {
    await renderApp();
    open();

    fireEvent.submit(form());
    expect(screen.getByText('Please enter an asset name')).toBeTruthy();

    fill('Name', 'BTC');
    fireEvent.submit(form());
    expect(screen.getByText('Please choose or enter a platform')).toBeTruthy();

    fill('Platform', 'Binance');
    fireEvent.submit(form());
    expect(screen.getByText('Please choose or enter an asset class')).toBeTruthy();

    fill('Asset class', 'Crypto');
    fireEvent.submit(form());
    expect(screen.getByText('Please enter a value')).toBeTruthy();

    // The field says what's wrong as soon as it's typed; submitting says it again, at the top.
    fill('Value (USD)', 'ten');
    expect(screen.getByText('Enter an amount like 1,234.56', { selector: '.field-error' })).toBeTruthy();
    expect(screen.getByLabelText('Value (USD)').getAttribute('aria-invalid')).toBe('true');
    fireEvent.submit(form());
    expect(screen.getByText('Enter an amount like 1,234.56', { selector: '.form-error' })).toBeTruthy();

    fill('Value (USD)', '-5');
    fireEvent.submit(form());
    expect(screen.getAllByText("Amounts can't be negative")).toHaveLength(2);
    expect(requests('POST', '/api/v1/holdings')).toHaveLength(0);

    // An account that's empty for now is worth 0.
    routes['POST /api/v1/holdings'] = () => json({}, 201);
    fill('Value (USD)', '0');
    fireEvent.submit(form());
    await waitFor(() => expect(requests('POST', '/api/v1/holdings')).toHaveLength(1));
    expect(sent().valueUsd).toBe(0);
  });

  it.each([
    ['an API error', () => json({ detail: 'PlatformName exceeds max length' }, 400), 'PlatformName exceeds max length'],
    ['a network error', () => Promise.reject(new TypeError('offline')), 'Could not save this asset. Please try again.'],
  ])('keeps the dialog open on %s', async (_name, route, message) => {
    routes['POST /api/v1/holdings'] = route;
    await renderApp();
    open();
    fill('Name', 'VOO');
    fill('Platform', 'Vault');
    fill('Asset class', 'Equity');
    fill('Value (USD)', '1');
    fireEvent.submit(form());

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save asset' })).toBeTruthy();
  });

  it('closes with Cancel, Escape or the backdrop, but not when clicking or selecting inside', async () => {
    await renderApp();
    const opener = screen.getByRole('button', { name: 'New' });

    // Back to New, where it was opened from.
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    open();
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Selecting text in a field and letting go over the backdrop keeps the form.
    const backdrop = document.querySelector('.dialog-backdrop')!;
    fireEvent.mouseDown(screen.getByLabelText('Name'));
    fireEvent.click(backdrop);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('profile', () => {
  it('shows the user and signs out', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Ana Pérez/ }));

    const dialog = screen.getByText('Profile').closest('.dialog') as HTMLElement;
    expect(within(dialog).getByText('Ana Pérez')).toBeTruthy();
    expect(within(dialog).getByText('ana@example.com')).toBeTruthy();
    expect(within(dialog).getByText('$12,346')).toBeTruthy();
    expect(within(dialog).getByText('A')).toBeTruthy();

    fireEvent.click(dialog);
    expect(screen.getByText('Profile')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Profile')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ana Pérez/ }));
    expect(screen.getByRole('dialog', { name: 'Profile' })).toBeTruthy();
    const backdrop = document.querySelector('.dialog-backdrop')!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('shows initials, never a remote image, and ignores metadata that is not text', async () => {
    // user_metadata is editable by its owner: none of this may break the UI or load a remote URL.
    await renderApp({
      ...SESSION,
      user: {
        id: 'u2',
        email: 'bo@example.com',
        user_metadata: { picture: 'https://example.com/bo.png', avatar_url: 'https://example.com/bo.png', full_name: 42, name: '  ' },
      },
    } as unknown as Session);

    fireEvent.click(screen.getByRole('button', { name: /bo@example.com/ }));
    expect(within(screen.getByRole('complementary')).getAllByText('B')).toHaveLength(1);
    expect(within(screen.getByRole('dialog')).getAllByText('B')).toHaveLength(1);
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('takes whole characters as initials, emoji included', async () => {
    routes['GET /api/v1/wealth/summary'] = () =>
      json(summary({ byPlatform: [{ name: '\u{1F3E6} Bank', type: 'Bank', valueUsd: 12345.6, pct: 100, count: 3, avatarText: null, color: null }] }));
    await renderApp({
      ...SESSION,
      user: { id: 'u3', email: 'e@example.com', user_metadata: { full_name: '\u{1F600} Tomás' } },
    } as unknown as Session);

    fireEvent.click(screen.getByRole('button', { name: /Tomás/ }));
    expect(screen.getAllByText('\u{1F600}')).toHaveLength(2);
    nav('Platforms');
    expect(screen.getByText('\u{1F3E6}')).toBeTruthy();
  });
});

describe('multiple accounts', () => {
  const BOB = {
    access_token: 'tok-bob',
    user: { id: 'u2', email: 'bob@example.com', user_metadata: {} },
  } as unknown as Session;

  const bobSummary = summary({
    netWorth: { usd: 777 },
    holdingsCount: 1,
    byAssetClass: [{ assetClass: 'Fixed Income', valueUsd: 777, pct: 100, count: 1, color: null, liquid: false }],
    byPlatform: [{ name: 'Bob Bank', type: 'Bank', valueUsd: 777, pct: 100, count: 1, avatarText: null, color: null }],
  });

  // Like the real backend: what comes back depends only on whose token the request carries.
  beforeEach(() => {
    const perToken = (alice: unknown, bob: unknown) => (init: RequestInit) =>
      json((init.headers as Record<string, string>).Authorization === 'Bearer tok-bob' ? bob : alice);
    routes['GET /api/v1/wealth/summary'] = perToken(summary(), bobSummary);
    routes['GET /api/v1/holdings'] = perToken(HOLDINGS, [holding('b1', 'Bob bond', 'Fixed Income', 'Bob Bank', 777)]);
    routes['GET /api/v1/platforms'] = perToken(PLATFORMS, [{ name: 'Bob Bank', type: 'Other', createdAt: '' }]);
    routes['GET /api/v1/wealth/snapshots'] = perToken(SNAPSHOTS, []);
  });

  const signInAsBob = () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: BOB } } as never);
    act(() => authListener('SIGNED_IN', BOB));
  };

  const expectOnlyBob = async () => {
    expect(await screen.findByText('$777')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bob@example.com/ })).toBeTruthy();
    expect(screen.queryByText('$12,346')).toBeNull();
    expect(screen.queryByText('Ana Pérez')).toBeNull();
    nav('Assets');
    expect(screen.getByText('Bob bond')).toBeTruthy();
    expect(screen.queryByText('SPY')).toBeNull();
    nav('History');
    expect(screen.getByText('No checkpoints yet')).toBeTruthy();
  };

  it('signing out and in as someone else shows only their data', async () => {
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    expect(screen.getByText('Gold bar')).toBeTruthy();

    act(() => authListener('SIGNED_OUT', null));
    await screen.findByText('Sign in to see your full financial picture.');
    const sentBeforeBob = fetchMock.mock.calls.length;

    signInAsBob();
    await expectOnlyBob();
    // Nothing carried over from Alice's session (view, filters), and every request since went out as Bob.
    nav('Assets');
    expect(screen.getByText('Bob bond')).toBeTruthy();
    const sinceBob = fetchMock.mock.calls.slice(sentBeforeBob);
    expect(sinceBob.length).toBeGreaterThan(0);
    for (const [, init] of sinceBob) expect(init.headers.Authorization).toBe('Bearer tok-bob');
  });

  it('another tab signing in as someone else swaps the whole dashboard', async () => {
    await renderApp();
    signInAsBob();
    await expectOnlyBob();
  });

  it("a slow answer for the previous account never shows up under the new one", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const summaries = routes['GET /api/v1/wealth/summary'];
    routes['GET /api/v1/wealth/summary'] = async (init) => {
      if ((init.headers as Record<string, string>).Authorization === 'Bearer tok') await gate;
      return summaries(init);
    };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    await waitFor(() => expect(requests('GET', '/api/v1/wealth/summary')).toHaveLength(1));

    signInAsBob();
    expect(await screen.findByText('$777')).toBeTruthy();

    await act(async () => release());
    expect(screen.getByText('$777')).toBeTruthy();
    expect(screen.queryByText('$12,346')).toBeNull();
  });

  it('can sign out from the error screen, e.g. to switch accounts', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json({ detail: 'Database unavailable' }, 503);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: SESSION } } as never);
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    await screen.findByText("Couldn't load your data: Database unavailable");

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
