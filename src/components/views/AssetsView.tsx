'use client';

import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Percent, Search } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency } from '@/lib/calculations';
import { ClassTag } from '@/components/ui/ClassTag';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { PlatformSelectFrame } from '@/components/ui/PlatformSelectFrame';
import { ALL, INITIAL_ASSETS_TABLE, selectAssets, sumValues, toggleSort, type AssetSortKey, ASSETS_SEARCH_ID } from '@/lib/assetsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHoldingActions } from '@/components/dialogs/useHoldingActions';
import { HoldingRowActions } from '@/components/dialogs/HoldingRowActions';
import { useOpenFromRow, useOpenHolding } from '@/components/dialogs/HoldingDrawer';
import { formatReturn } from '@/lib/returns';

// On a phone, the optional ones are left out (they're in each asset's panel).
const COLUMNS: { key: AssetSortKey; label: string; optional?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'assetClass', label: 'Class', optional: true },
  { key: 'platform', label: 'Platform', optional: true },
  { key: 'valueUsd', label: 'Value' },
  { key: 'effectiveReturnPct', label: 'Return/yr', optional: true },
];
const OPTIONAL = 'col-optional';

const pctOf = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');

export const AssetsView: React.FC = () => {
  const { holdings, platforms, availableAssetClasses, assetsTable, setAssetsTable, openPlatform, platformLook, classLook } = useWealth();
  const actions = useHoldingActions();
  const openHolding = useOpenHolding();
  const openFromRow = useOpenFromRow();

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
            id={ASSETS_SEARCH_ID}
            type="search"
            aria-label="Search assets"
            placeholder="Search by name, platform or class"
            value={table.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <PlatformSelectFrame platform={table.platform === ALL ? null : table.platform}>
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
        </PlatformSelectFrame>
        <button type="button" className="btn btn-secondary toolbar-end" onClick={actions.setReturns}>
          <Percent size={14} aria-hidden />
          Set expected returns
        </button>
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
              {opt !== ALL && <span className="class-dot" style={{ background: classLook(opt).color }} aria-hidden />}
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
                {COLUMNS.map(({ key, label, optional }) => {
                  const active = table.sort.key === key;
                  const SortIcon = active ? (table.sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <th
                      key={key}
                      className={optional ? OPTIONAL : undefined}
                      aria-sort={active ? (table.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <button type="button" className="th-sort" onClick={() => update({ sort: toggleSort(table.sort, key) })}>
                        {label}
                        <SortIcon size={13} aria-hidden style={{ opacity: active ? 1 : 0.4 }} />
                      </button>
                    </th>
                  );
                })}
                {/* The share of all assets: sorts like Value, so it has no sort of its own. */}
                <th className={OPTIONAL}>Share</th>
                <th className="col-actions" style={{ width: '132px' }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="row-clickable" onClick={(e) => openFromRow(e, h)}>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }}>
                    <button type="button" className="link-btn" data-holding-name onClick={() => openHolding(h)}>
                      {h.name}
                    </button>
                  </td>
                  <td style={{ padding: '12px 10px' }} className={OPTIONAL}>
                    <ClassTag name={h.assetClass} />
                  </td>
                  <td style={{ padding: '12px 10px' }} className={OPTIONAL}>
                    <button type="button" className="link-btn text-muted with-avatar" title={`Open ${h.platform}`} onClick={() => openPlatform(h.platform)}>
                      <PlatformAvatar {...platformLook(h.platform)} size={18} />
                      {h.platform}
                    </button>
                  </td>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }} className="text-nowrap">
                    {formatCurrency(h.valueUsd)}
                  </td>
                  <td style={{ padding: '12px 10px', fontVariantNumeric: 'tabular-nums' }} className={`text-nowrap ${OPTIONAL}`}>
                    {h.effectiveReturnPct === null ? <span className="text-muted">—</span> : formatReturn(h.effectiveReturnPct, 2)}
                  </td>
                  <td style={{ padding: '12px 10px', fontVariantNumeric: 'tabular-nums' }} className={`text-muted ${OPTIONAL}`}>
                    {pctOf(h.valueUsd, totalAssets)}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <HoldingRowActions holding={h} />
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
