import type { Holding } from '@/types/wealth';
import { matchesQuery } from './search';

export type AssetSortKey = 'name' | 'assetClass' | 'platform' | 'valueUsd';
export type SortDirection = 'asc' | 'desc';

/** What the Assets table shows: kept while the user moves between views. */
export interface AssetsTableState {
  query: string;
  /** 'All' or a class. */
  assetClass: string;
  /** 'All' or a platform. */
  platform: string;
  sort: { key: AssetSortKey; dir: SortDirection };
}

export const ALL = 'All';

export const INITIAL_ASSETS_TABLE: AssetsTableState = {
  query: '',
  assetClass: ALL,
  platform: ALL,
  sort: { key: 'valueUsd', dir: 'desc' },
};

const byText = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);

/** The holdings the table shows, filtered and sorted (ties by name, so the order is stable). */
export function selectAssets(holdings: Holding[], table: AssetsTableState): Holding[] {
  const shown = holdings.filter(
    (h) =>
      (table.assetClass === ALL || h.assetClass === table.assetClass) &&
      (table.platform === ALL || h.platform === table.platform) &&
      matchesQuery(table.query, [h.name, h.platform, h.assetClass]),
  );
  const { key, dir } = table.sort;
  const sign = dir === 'asc' ? 1 : -1;
  return shown.sort((a, b) => {
    const order = key === 'valueUsd' ? a.valueUsd - b.valueUsd : byText(a[key], b[key]);
    return order * sign || byText(a.name, b.name);
  });
}

/** Clicking a column: sorts by it, or flips its direction if it already sorts. Amounts start largest first. */
export function toggleSort(sort: AssetsTableState['sort'], key: AssetSortKey): AssetsTableState['sort'] {
  if (sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'valueUsd' ? 'desc' : 'asc' };
}

export const sumValues = (holdings: Holding[]) => Math.round(holdings.reduce((sum, h) => sum + h.valueUsd, 0) * 100) / 100;
