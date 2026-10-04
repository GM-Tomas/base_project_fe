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
    expect(await screen.findByText('$107,420')).toBeTruthy();
    expect(screen.getByText('Demo data')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add an asset' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Vanguard S&P 500 ETF'), { target: { value: 'Solana' } });
    const [platform, assetClass] = screen.getAllByRole('combobox');
    fireEvent.change(platform, { target: { value: 'Binance' } });
    fireEvent.change(assetClass, { target: { value: 'Crypto' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save asset' }).closest('form')!);
    expect(await screen.findByText('$108,420')).toBeTruthy();

    // Signing out shows the login, where anything signs back in to the same demo data.
    fireEvent.click(screen.getByRole('button', { name: /Demo account/ }));
    const dialog = screen.getByText('Profile').closest('.dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('A preview with demo data: any email and password sign in.')).toBeTruthy();

    fireEvent.change(document.querySelector('input[type=email]')!, { target: { value: 'me@example.com' } });
    fireEvent.change(document.querySelector('input[type=password]')!, { target: { value: 'whatever' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('$108,420')).toBeTruthy();

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
