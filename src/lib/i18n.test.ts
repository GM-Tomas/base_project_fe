import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { intlLocale, language, languageSetting, messages, setLanguageSetting, useLanguage, useT } from './i18n';
import { en, type Messages } from '@/i18n/en';
import { es } from '@/i18n/es';
import { formatCurrency, formatPercentage, formatSignedPercentage } from './calculations';
import { compactUsd } from './chartScale';
import { formatMonth, formatRate, payoffText } from './debts';
import { exactUsd, formatUsd, parseAmount } from './money';
import { formatDay, undoSentence } from './movements';
import { describeSpan } from './periods';
import { formatReturn, parsePercent } from './returns';
import { listNames } from '@/components/views/DashboardView';

afterEach(() => {
  setLanguageSetting('auto');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the language', () => {
  it("is the browser's until one is picked, kept on this device", () => {
    expect(languageSetting()).toBe('auto');
    expect(language()).toBe('en'); // jsdom's is en-US
    vi.stubGlobal('navigator', { ...navigator, language: 'es-AR' });
    expect(language()).toBe('es');

    setLanguageSetting('en');
    expect(language()).toBe('en');
    expect(localStorage.getItem('base.language')).toBe('en');
    setLanguageSetting('auto');
    expect(localStorage.getItem('base.language')).toBeNull();
    expect(language()).toBe('es');
  });

  it('re-renders what uses it, here and when another tab changes it', () => {
    const { result } = renderHook(() => [useLanguage(), useT().nav.dashboard]);
    expect(result.current).toEqual(['en', 'Dashboard']);
    act(() => setLanguageSetting('es'));
    expect(result.current).toEqual(['es', 'Inicio']);
    expect(intlLocale()).toBe('es-AR');
    expect(messages()).toBe(es);

    // Another tab picked English.
    localStorage.setItem('base.language', 'en');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'base.language' }));
    });
    expect(result.current).toEqual(['en', 'Dashboard']);
    // Someone else's key changes nothing.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'base.hideAmounts' }));
    });
    expect(result.current).toEqual(['en', 'Dashboard']);
  });

  it('still works when the browser keeps nothing', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setLanguageSetting('es');
    expect(language()).toBe('es');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.resetModules();
    const fresh = await import('./i18n');
    expect(fresh.languageSetting()).toBe('auto');
  });
});

describe('the dictionaries', () => {
  // Identical in both on purpose: names, codes, words Spanish borrows as they are.
  const SAME = new Set([
    'Email', 'Color', 'General', 'Personal', 'Magenta', 'Exchange', 'Broker', 'English', 'Español', '1–31', '1M', '3M', '6M',
    'p. ej. Visa Gold', 'p. ej. Santander', 'p. ej. Balanz', 'Max',
  ]);
  const leaves = (dict: unknown, path = ''): [string, string][] =>
    typeof dict === 'string'
      ? [[path, dict]]
      : Array.isArray(dict)
        ? dict.flatMap((v, i) => leaves(v, `${path}[${i}]`))
        : typeof dict === 'object' && dict
          ? Object.entries(dict).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
          : [];

  it('have Spanish for every English text', () => {
    const spanish = new Map(leaves(es));
    const untranslated = leaves(en).filter(([path, text]) => spanish.get(path) === text && !SAME.has(text) && !/^[\s·:—…-]*$/.test(text));
    // Platform types are offered, not translated data: Exchange and Broker are the same words.
    expect(untranslated.map(([path]) => path)).toEqual([]);
    expect(leaves(es).map(([p]) => p)).toEqual(leaves(en).map(([p]) => p));
  });

  it('build every sentence, in both languages', () => {
    // One argument that reads as a number, a name, a flag or a list of names, whatever each sentence asks for.
    const anything = Object.assign(['Gold', 'Cash'], { toString: () => '7', valueOf: () => 7, toLowerCase: () => 'gain' });
    const sentences = (dict: unknown): ((...args: unknown[]) => unknown)[] =>
      typeof dict === 'function'
        ? [dict as (...args: unknown[]) => unknown]
        : typeof dict === 'object' && dict
          ? Object.values(dict).flatMap(sentences)
          : [];
    for (const dict of [en, es]) {
      const built = sentences(dict).map((say) => say(anything, anything, anything, anything));
      expect(built.every((text) => typeof text === 'string' && text.length > 0)).toBe(true);
    }
    expect(sentences(es)).toHaveLength(sentences(en).length);
  });

  it('say the same things with their numbers and names', () => {
    const t: Messages = es;
    expect(t.common.assets(1)).toBe('1 activo');
    expect(t.common.assets(3)).toBe('3 activos');
    expect(t.debts.dueOn(10)).toBe('Vence el 10');
    expect(en.debts.dueOn(22)).toBe('Due on the 22nd');
    expect(en.debts.onThe(13)).toBe('On the 13th');
    expect(t.dashboard.counts(1, 2)).toBe('1 plataforma · 2 activos');
    expect(t.breakdown.transfers(1)).toBe(' 1 transferencia movió plata entre lo que tenés y lo que debés sin cambiarlo.');
    expect(t.estimate.useMyPortfolio(null)).toBe('Usar el de mi cartera');
  });
});

describe('numbers and dates in Spanish', () => {
  it('are written as in Argentina, and read back', () => {
    setLanguageSetting('es');
    expect(formatCurrency(97770.4)).toBe('$97.770');
    expect(formatCurrency(-5000)).toBe('−$5.000');
    expect(formatUsd(1234.5)).toBe('$1.234,50');
    expect(exactUsd(-2500)).toBe('-$2.500,00');
    expect(parseAmount(exactUsd(1234.5))).toEqual({ value: 1234.5 });
    expect(formatPercentage(22.2)).toBe('+22,2%');
    expect(formatPercentage(-18.24)).toBe('-18,2%');
    expect(formatSignedPercentage(-4)).toBe('−4,0%');
    expect(formatReturn(9.6)).toBe('9,6%');
    expect(formatRate(12.5)).toBe('12,5%');
    expect(compactUsd(1_500_000)).toBe('$1,5M');
    expect(formatDay('2026-01-15T12:00:00Z')).toMatch(/^15( de)? ene\.?( de)? 2026$/);
    expect(formatMonth('2029-02')).toMatch(/^feb\.?( de)? 2029$/);
    expect(describeSpan(new Date(2026, 0, 1), new Date(2027, 6, 1))).toBe('1,5 años');
    expect(listNames(['Cash', 'Crypto', 'Equity', 'Gold', 'Art'])).toBe('Cash, Crypto, Equity y 2 más');
    expect(payoffText({ status: 'ON_TRACK', months: 1, payoffMonth: '2026-11', totalInterestUsd: 0 })).toMatchObject({
      text: expect.stringMatching(/^Saldada en 1 mes · nov/),
    });
    expect(parsePercent('abc')).toEqual({ error: 'Escribí un porcentaje, como 7,5' });
    expect(parseAmount('abc')).toEqual({ error: 'Escribí un monto, como 1.234,56' });
  });

  it('describe what undoing does', () => {
    setLanguageSetting('es');
    const holding = { id: 'h1', name: 'Bitcoin', platform: 'Binance', assetClass: 'Crypto', exists: true };
    expect(
      undoSentence({
        id: 'm1', kind: 'GAIN', occurredAt: '', createdAt: '', amountUsd: 50, feeUsd: null, holding, toHolding: null, debt: null,
        previousValueUsd: null, newValueUsd: null, note: null, revertible: true,
      }),
    ).toBe('Deshacerlo le saca $50,00 a Bitcoin.');
  });
});
