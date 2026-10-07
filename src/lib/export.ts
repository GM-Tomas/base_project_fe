import type { Api } from './api';
import type { AssetClassInfo, Debt, Holding, Movement, Platform, Preferences, Snapshot } from '@/types/wealth';
import { today } from './movements';
import { en } from '@/i18n/en';

// The files keep one format whatever the app's language (they're read by spreadsheets and scripts): English.
const KIND_LABEL = en.movements.kinds;
const DEBT_KIND_LABEL = en.debts.kinds;

// Settings → Your data: everything recorded, built in the browser from the API (there's no export endpoint).
// One JSON file with all of it, or a CSV per list for a spreadsheet. Amounts are plain numbers, never hidden
// by the privacy mode.

export const EXPORT_FORMAT = 'base-wealth-export';
export const EXPORT_VERSION = 1;

/** The JSON export: what the API answers, as it answers it, with when it was exported and how it's laid out. */
export interface WealthExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  holdings: Holding[];
  debts: Debt[];
  /** Every movement, newest first. */
  movements: Movement[];
  snapshots: Snapshot[];
  assetClasses: AssetClassInfo[];
  platforms: Platform[];
  preferences: Preferences;
}

const PAGE = 200;

/** Every movement recorded, a page at a time, newest first. */
export async function allMovements(source: Pick<Api, 'getMovements'>): Promise<Movement[]> {
  const items: Movement[] = [];
  let cursor: string | undefined;
  do {
    const page = await source.getMovements({ limit: PAGE, cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export async function exportEverything(source: Api, now: Date = new Date()): Promise<WealthExport> {
  const [holdings, debts, movements, snapshots, classes, platforms, preferences] = await Promise.all([
    source.getHoldings(),
    source.getDebts(),
    allMovements(source),
    source.getSnapshots(),
    source.getAssetClasses(),
    source.getPlatforms(),
    source.getPreferences(),
  ]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    holdings,
    debts,
    movements,
    snapshots,
    assetClasses: classes.classes ?? [],
    platforms,
    preferences,
  };
}

type Cell = string | number | null | undefined;

/**
 * A value as a CSV cell: quoted when it has a comma, a quote or a line break. Text a spreadsheet would run
 * as a formula (=, +, -, @ first) is kept as text with a leading apostrophe.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV file: UTF-8 with a BOM (so Excel reads accents right), comma-separated, CRLF line endings. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export const assetsCsv = (holdings: Holding[]) =>
  toCsv(
    ['Name', 'Class', 'Platform', 'Value (USD)', 'Expected return (% a year)', 'Return counted (% a year)', 'Added', 'Updated'],
    holdings.map((h) => [h.name, h.assetClass, h.platform, h.valueUsd, h.expectedReturnPct, h.effectiveReturnPct, h.createdAt, h.updatedAt]),
  );

export const debtsCsv = (debts: Debt[]) =>
  toCsv(
    ['Name', 'Lender', 'Kind', 'Balance (USD)', 'Rate (% a year)', 'Monthly payment (USD)', 'Due day', 'Notes', 'Added'],
    debts.map((d) => [
      d.name,
      d.lender,
      DEBT_KIND_LABEL[d.kind],
      d.balanceUsd,
      d.interestRatePct,
      d.monthlyPaymentUsd,
      d.dueDay,
      d.notes,
      d.createdAt,
    ]),
  );

export const activityCsv = (movements: Movement[]) =>
  toCsv(
    ['Date', 'Kind', 'Asset', 'Platform', 'To asset', 'To platform', 'Debt', 'Amount (USD)', 'Fee (USD)', 'Value before (USD)', 'Value after (USD)', 'Note'],
    movements.map((m) => [
      m.occurredAt,
      KIND_LABEL[m.kind],
      m.holding?.name,
      m.holding?.platform,
      m.toHolding?.name,
      m.toHolding?.platform,
      m.debt?.name,
      m.amountUsd,
      m.feeUsd,
      m.previousValueUsd,
      m.newValueUsd,
      m.note,
    ]),
  );

export const checkpointsCsv = (snapshots: Snapshot[]) =>
  toCsv(
    ['Date', 'Net worth (USD)', 'Assets (USD)', 'Debts (USD)', 'Added by hand', 'Note'],
    snapshots.map((s) => [s.capturedAt, s.totalValueUsd, s.assetsUsd, s.debtsUsd, s.source === 'MANUAL' ? 'Yes' : 'No', s.note]),
  );

/** "base-assets-2026-10-06.csv": what it is and the day it was exported (here). */
export const exportName = (what: string, extension: 'json' | 'csv', now: Date = new Date()) => `base-${what}-${today(now)}.${extension}`;

/** Hands the browser a file to save. */
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked once the browser has started on it (right away can cancel it in some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
