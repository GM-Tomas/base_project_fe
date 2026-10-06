import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

// What a Vercel preview runs: the real app on mock data (no Supabase, no API), as next.config.mjs builds it.
describe('on mock data', () => {
  it('runs on a demo account, keeps changes in the tab, and never calls the network', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'mock');
    vi.doUnmock('@/lib/supabaseClient');
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { default: HomePage } = await import('@/app/page');
    const { AuthProvider } = await import('@/context/AuthContext');

    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    // The net worth: what's owned, less what's owed.
    expect(await screen.findByText('$97,770')).toBeTruthy();
    expect(screen.getByText('Assets $107,420 · Debts $9,650')).toBeTruthy();
    expect(screen.getByText('Demo data')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy(); // the tag stays out of the title

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Asset' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Vanguard S&P 500 ETF'), { target: { value: 'Solana' } });
    const [platform, assetClass] = screen.getAllByRole('combobox');
    fireEvent.change(platform, { target: { value: 'Binance' } });
    fireEvent.change(assetClass, { target: { value: 'Crypto' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save asset' }).closest('form')!);
    expect(await screen.findByText('$98,770')).toBeTruthy();

    // Signing out shows the login, where anything signs back in to the same demo data.
    fireEvent.click(screen.getByRole('button', { name: /Demo account/ }));
    const dialog = screen.getByText('Profile').closest('.dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('A preview with demo data: any email and password sign in.')).toBeTruthy();

    fireEvent.change(document.querySelector('input[type=email]')!, { target: { value: 'me@example.com' } });
    fireEvent.change(document.querySelector('input[type=password]')!, { target: { value: 'whatever' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('$98,770')).toBeTruthy();

    // Movements too: a gain changes the value and joins the demo's activity, and can be undone.
    fireEvent.click(screen.getByRole('button', { name: 'Assets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record a change to Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '580' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record gain' }));
    expect(await screen.findByText('8 assets · $109,000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    // All of it, from when the demo's assets were added (over a year ago).
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Activity' })).getAllByRole('listitem')).toHaveLength(22));
    const activity = screen.getByRole('list', { name: 'Activity' });
    expect(within(activity).getByText('+$580.00')).toBeTruthy();
    fireEvent.click(within(activity).getByRole('button', { name: 'Undo gain of $580.00 on Bitcoin' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Undo this change?' })).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Activity' })).queryByText('+$580.00')).toBeNull());

    // Debts: paying one off raises the net worth.
    // (History has a Debts filter too: the one in the navigation.)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Debts' }));
    expect(screen.getByText('Feb 2029')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay Visa Gold' }));
    expect((screen.getByLabelText('Amount (USD)') as HTMLInputElement).value).toBe('$300.00');
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Payment recorded')).toBeTruthy();
    expect(screen.getByText('$950')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByText('$99,070')).toBeTruthy();

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
