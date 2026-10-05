import { describe, expect, it } from 'vitest';
import type { Holding } from '@/types/wealth';
import { INITIAL_ASSETS_TABLE, selectAssets, sumValues, toggleSort, type AssetsTableState } from './assetsTable';
import { matchesQuery, normalizeForSearch } from './search';

const holding = (name: string, assetClass: string, platform: string, valueUsd: number, returnPct: number | null = null): Holding => ({
  id: name, name, assetClass, platform, valueUsd, expectedReturnPct: returnPct, effectiveReturnPct: returnPct, createdAt: '', updatedAt: '',
});

const HOLDINGS = [
  holding('Café Martínez shares', 'Equity', 'Balanz', 500, 9),
  holding('Bitcoin', 'Crypto', 'Binance', 18_450, 20),
  holding('ethereum', 'Crypto', 'Binance', 6_120, 20),
  holding('Savings', 'Cash', 'Santander', 9_500),
  holding('Apple', 'Equity', 'Balanz', 500, -5),
];

const names = (table: Partial<AssetsTableState>) => selectAssets(HOLDINGS, { ...INITIAL_ASSETS_TABLE, ...table }).map((h) => h.name);

describe('search', () => {
  it('ignores accents and case', () => {
    expect(normalizeForSearch('Café ÁRBOL')).toBe('cafe arbol');
    expect(matchesQuery('cafe', ['Café'])).toBe(true);
    expect(matchesQuery('BINANCE', ['binance'])).toBe(true);
  });

  it('needs every word, in any field and order', () => {
    expect(matchesQuery('binance bit', ['Bitcoin', 'Binance', 'Crypto'])).toBe(true);
    expect(matchesQuery('binance gold', ['Bitcoin', 'Binance', 'Crypto'])).toBe(false);
    expect(matchesQuery('   ', ['anything'])).toBe(true);
  });
});

describe('selectAssets', () => {
  it('starts with everything, largest first, ties by name', () => {
    expect(names({})).toEqual(['Bitcoin', 'Savings', 'ethereum', 'Apple', 'Café Martínez shares']);
  });

  it('combines the search with the class and platform filters', () => {
    expect(names({ query: 'cafe' })).toEqual(['Café Martínez shares']);
    expect(names({ assetClass: 'Crypto' })).toEqual(['Bitcoin', 'ethereum']);
    expect(names({ platform: 'Balanz' })).toEqual(['Apple', 'Café Martínez shares']);
    expect(names({ assetClass: 'Crypto', query: 'eth' })).toEqual(['ethereum']);
    expect(names({ assetClass: 'Crypto', platform: 'Santander' })).toEqual([]);
  });

  it('sorts by any column, both ways, ignoring case', () => {
    expect(names({ sort: { key: 'name', dir: 'asc' } })).toEqual(['Apple', 'Bitcoin', 'Café Martínez shares', 'ethereum', 'Savings']);
    expect(names({ sort: { key: 'name', dir: 'desc' } })).toEqual(['Savings', 'ethereum', 'Café Martínez shares', 'Bitcoin', 'Apple']);
    expect(names({ sort: { key: 'platform', dir: 'asc' } })).toEqual(['Apple', 'Café Martínez shares', 'Bitcoin', 'ethereum', 'Savings']);
    expect(names({ sort: { key: 'assetClass', dir: 'asc' } })).toEqual(['Savings', 'Bitcoin', 'ethereum', 'Apple', 'Café Martínez shares']);
    expect(names({ sort: { key: 'valueUsd', dir: 'asc' } })).toEqual(['Apple', 'Café Martínez shares', 'ethereum', 'Savings', 'Bitcoin']);
    // Those without a return last, either way.
    expect(names({ sort: { key: 'effectiveReturnPct', dir: 'desc' } })).toEqual(['Bitcoin', 'ethereum', 'Café Martínez shares', 'Apple', 'Savings']);
    expect(names({ sort: { key: 'effectiveReturnPct', dir: 'asc' } })).toEqual(['Apple', 'Café Martínez shares', 'Bitcoin', 'ethereum', 'Savings']);
  });

  it("doesn't touch the list it's given", () => {
    const before = HOLDINGS.map((h) => h.name);
    selectAssets(HOLDINGS, { ...INITIAL_ASSETS_TABLE, sort: { key: 'name', dir: 'asc' } });
    expect(HOLDINGS.map((h) => h.name)).toEqual(before);
  });
});

describe('toggleSort', () => {
  it('flips the sorted column and starts others ascending, amounts descending', () => {
    expect(toggleSort({ key: 'valueUsd', dir: 'desc' }, 'valueUsd')).toEqual({ key: 'valueUsd', dir: 'asc' });
    expect(toggleSort({ key: 'valueUsd', dir: 'asc' }, 'valueUsd')).toEqual({ key: 'valueUsd', dir: 'desc' });
    expect(toggleSort({ key: 'valueUsd', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
    expect(toggleSort({ key: 'name', dir: 'asc' }, 'valueUsd')).toEqual({ key: 'valueUsd', dir: 'desc' });
    expect(toggleSort({ key: 'name', dir: 'asc' }, 'effectiveReturnPct')).toEqual({ key: 'effectiveReturnPct', dir: 'desc' });
  });
});

describe('sumValues', () => {
  it('adds up to the cent', () => {
    expect(sumValues([holding('a', 'x', 'y', 0.1), holding('b', 'x', 'y', 0.2)])).toBe(0.3);
    expect(sumValues([])).toBe(0);
  });
});
