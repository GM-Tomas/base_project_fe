'use client';

import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Pencil, Search, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency } from '@/lib/calculations';
import { assetClassTag } from '@/lib/constants';
import { ALL, INITIAL_ASSETS_TABLE, selectAssets, sumValues, toggleSort, type AssetSortKey } from '@/lib/assetsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useHoldingActions } from '@/components/dialogs/useHoldingActions';

const COLUMNS: { key: AssetSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'assetClass', label: 'Class' },
  { key: 'platform', label: 'Platform' },
  { key: 'valueUsd', label: 'Value' },
];

const pctOf = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');

export const AssetsView: React.FC = () => {
  const { holdings, platforms, availableAssetClasses, assetsTable, setAssetsTable, openPlatform } = useWealth();
  const actions = useHoldingActions();

  const update = (patch: Partial<typeof assetsTable>) => setAssetsTable((table) => ({ ...table, ...patch }));
  // A filter on a class or platform that's gone since (its last asset was removed) shows everything.
  const platformNames = platforms.map((p) => p.name);
  const table = {
    ...assetsTable,
    assetClass: availableAssetClasses.includes(assetsTable.assetClass) ? assetsTable.assetClass : ALL,
    platform: platformNames.includes(assetsTable.platform) ? assetsTable.platform : ALL,
  };
  const rows = selectAssets(holdings, table);
  const totalAssets = sumValues(holdings);
  const shownTotal = sumValues(rows);
  const filtered = rows.length !== holdings.length;

  if (holdings.length === 0) {
    return (
      <div className="card elev-sm">
        <EmptyState
          title="Start by adding what you own"
          action={
            <button className="btn btn-primary" onClick={() => actions.add()}>
              Add your first asset
            </button>
          }
        >
          Add each account, fund or coin with what it&apos;s worth in dollars: BASE adds them up and shows where your
          money lives.
        </EmptyState>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Search and platform filter */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-field">
          <Search size={15} aria-hidden />
          <input
            className="input"
            type="search"
            aria-label="Search assets"
            placeholder="Search by name, platform or class"
            value={table.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <select
          className="input"
          aria-label="Filter by platform"
          style={{ width: 'auto', minWidth: '180px' }}
          value={table.platform}
          onChange={(e) => update({ platform: e.target.value })}
        >
          <option value={ALL}>All platforms</option>
          {platformNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Class chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[ALL, ...availableAssetClasses].map((opt) => {
          const isActive = table.assetClass === opt;
          return (
            <button
              key={opt}
              onClick={() => update({ assetClass: opt })}
              aria-pressed={isActive}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--color-divider)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                background: isActive ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Holdings table */}
      <div className="card elev-sm" style={{ padding: '6px 16px 12px', overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <EmptyState
            title="No assets match this filter"
            action={
              <button className="btn btn-secondary" onClick={() => setAssetsTable({ ...INITIAL_ASSETS_TABLE, sort: table.sort })}>
                Show all
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map(({ key, label }) => {
                  const active = table.sort.key === key;
                  const SortIcon = active ? (table.sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <th key={key} aria-sort={active ? (table.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="th-sort" onClick={() => update({ sort: toggleSort(table.sort, key) })}>
                        {label}
                        <SortIcon size={13} aria-hidden style={{ opacity: active ? 1 : 0.4 }} />
                      </button>
                    </th>
                  );
                })}
                {/* The share of all assets: sorts like Value, so it has no sort of its own. */}
                <th>Share</th>
                <th style={{ width: '72px' }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }}>{h.name}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={assetClassTag(h.assetClass)}>{h.assetClass}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <button type="button" className="link-btn text-muted" title={`Open ${h.platform}`} onClick={() => openPlatform(h.platform)}>
                      {h.platform}
                    </button>
                  </td>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }} className="text-nowrap">
                    {formatCurrency(h.valueUsd)}
                  </td>
                  <td style={{ padding: '12px 10px', fontVariantNumeric: 'tabular-nums' }} className="text-muted">
                    {pctOf(h.valueUsd, totalAssets)}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <div className="row-actions">
                      <IconButton label={`Edit ${h.name}`} onClick={() => actions.edit(h)}>
                        <Pencil size={15} aria-hidden />
                      </IconButton>
                      <IconButton label={`Remove ${h.name}`} tone="danger" onClick={() => actions.remove(h)}>
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={COLUMNS.length + 2} className="table-total">
                  {rows.length} {rows.length === 1 ? 'asset' : 'assets'} · {formatCurrency(shownTotal)}
                  {filtered && ` · ${pctOf(shownTotal, totalAssets)} of your assets`}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
