import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import { DEFAULT_PREFERENCES } from '@/lib/preferences';
import { setLanguageSetting } from '@/lib/i18n';
import { installFakeBackend, json, nav, renderApp, requests, routes, tab } from './harness';

// F10: the app in Spanish or English. The account's preference picks it (else this device's, else the
// browser's); numbers and dates follow it; what the API refuses is said in it. The backend is faked
// (harness.tsx); the app runs for real.

installFakeBackend();

const sent = (method: string, path: string, i = 0) => JSON.parse(requests(method, path)[i][1].body);

describe('the app in Spanish', () => {
  it("opens in the account's language, with its numbers, everywhere", async () => {
    routes['GET /api/v1/preferences'] = () => json({ ...DEFAULT_PREFERENCES, language: 'es' });
    await renderApp(undefined, '$12.346');

    expect(document.documentElement.lang).toBe('es');
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeTruthy();
    const navigation = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(navigation).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Inicio',
      'Activos',
      'Deudas',
      'Proyección',
      'Historial',
      'Ajustes',
    ]);
    expect(screen.getByRole('region', { name: 'Patrimonio neto' })).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('64,8%')).toBeTruthy();

    nav('Activos');
    expect(screen.getByRole('searchbox', { name: 'Buscar activos' })).toBeTruthy();
    expect(screen.getByText('3 activos · $12.346')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de SPY' }));
    expect(screen.getByRole('menuitem', { name: 'Registrar un cambio' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    nav('Historial');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Resumen', 'Fotos', 'Actividad']);
    tab('Fotos');
    expect(screen.getByRole('button', { name: /^Borrar la foto del 15( de)? ene\.?( de)? 2026$/ })).toBeTruthy();

    nav('Ajustes');
    expect(screen.getByRole('tab', { name: 'General', selected: true })).toBeTruthy();
    expect((screen.getByLabelText('Idioma') as HTMLSelectElement).value).toBe('es');
  });

  it('switches to English from Settings, for every device', async () => {
    setLanguageSetting('es');
    await renderApp(undefined, '$12.346');
    nav('Ajustes');
    fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } });

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy();
    await waitFor(() => expect(requests('PUT', '/api/v1/preferences')).toHaveLength(1));
    expect(sent('PUT', '/api/v1/preferences')).toMatchObject({ language: 'en' });
    expect(localStorage.getItem('base.language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it("keeps this device's language when the account's is automatic", async () => {
    setLanguageSetting('es');
    await renderApp(undefined, '$12.346');
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeTruthy();
  });

  it('says what the API refused in Spanish', async () => {
    setLanguageSetting('es');
    routes['POST /api/v1/holdings'] = () => json({ detail: 'You can track up to 1000 holdings. Remove one to add another.' }, 409);
    await renderApp(undefined, '$12.346');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Activo' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar un activo' });
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'VOO' } });
    fireEvent.change(within(dialog).getByLabelText('Plataforma'), { target: { value: 'Balanz' } });
    fireEvent.change(within(dialog).getByLabelText('Clase'), { target: { value: 'Equity' } });
    fireEvent.change(within(dialog).getByLabelText('Valor (USD)'), { target: { value: '1.500,50' } });
    expect(within(dialog).getByText('= $1.500,50')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar activo' }));
    expect(await within(dialog).findByText('Podés seguir hasta 1000 activos. Eliminá uno para agregar otro.')).toBeTruthy();
  });

  it('has a language of its own on the sign-in screen', async () => {
    await renderApp(null);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'es' } });
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();

    // What Supabase says when it refuses, in Spanish too.
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } } as never);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!);
    expect(await screen.findByText('El email o la contraseña no son correctos')).toBeTruthy();
  });
});
