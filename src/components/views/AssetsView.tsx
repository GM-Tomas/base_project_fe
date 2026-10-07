'use client';

import React from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, ChevronsUpDown, Paintbrush, Percent, Plus, Search } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { IconButton } from '@/components/ui/IconButton';
import { PlatformCustomizeDialog } from '@/components/settings/PlatformCustomizeDialog';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { useT } from '@/lib/i18n';
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
const COLUMNS: { key: AssetSortKey; optional?: boolean }[] = [
  { key: 'name' },
  { key: 'assetClass', optional: true },
  { key: 'platform', optional: true },
  { key: 'valueUsd' },
  { key: 'effectiveReturnPct', optional: true },
];
const OPTIONAL = 'col-optional';

const pctOf = (part: number, whole: number) => (whole > 0 ? `${formatNumber((part / whole) * 100, 1, true)}%` : '—');

// The platform the table is filtered by, and what can be done there (its total and share are the table's).
function PlatformBar({ name }: { name: string }) {
  const { platforms, platformLook } = useWealth();
  const { openDialog } = useUi();
  const actions = useHoldingActions();
  const t = useT();
  const platform = platforms.find((p) => p.name === name);
  if (!platform) return null;
  return (
    <section className="card elev-sm platform-bar" aria-label={name}>
      <PlatformAvatar {...platformLook(name)} />
      <div className="platform-bar-text">
        <h2 className="platform-bar-name">{name}</h2>
        <div className="text-muted">{platform.type === 'Other' ? t.platformForm.noType : platform.type}</div>
      </div>
      <div className="platform-bar-actions">
        <button type="button" className="btn btn-secondary" onClick={() => actions.add(name)}>
          <Plus size={14} aria-hidden />
          {t.assets.addHere}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => actions.transfer({ platform: name })}>
          <ArrowLeftRight size={14} aria-hidden />
          {t.assets.transferHere}
        </button>
        <IconButton
          label={t.common.customize(name)}
          onClick={() => openDialog((close) => <PlatformCustomizeDialog platform={platform} onClose={close} />)}
        >
          <Paintbrush size={15} aria-hidden />
        </IconButton>
      </div>
    </section>
  );
}

export const AssetsView: React.FC = () => {
  const { holdings, platforms, availableAssetClasses, assetsTable, setAssetsTable, openPlatform, platformLook, classLook } = useWealth();
  const actions = useHoldingActions();
  const openHolding = useOpenHolding();
  const openFromRow = useOpenFromRow();
  const t = useT();

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
          title={t.dashboard.emptyTitle}
          action={
            <button className="btn btn-primary" onClick={() => actions.add()}>
              {t.dashboard.emptyButton}
            </button>
          }
        >
          {t.assets.emptyText}
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
            aria-label={t.assets.search}
            placeholder={t.assets.searchPlaceholder}
            value={table.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <PlatformSelectFrame platform={table.platform === ALL ? null : table.platform}>
          <select
            className="input"
            aria-label={t.assets.filterByPlatform}
            style={{ width: 'auto', minWidth: '180px' }}
            value={table.platform}
            onChange={(e) => update({ platform: e.target.value })}
          >
            <option value={ALL}>{t.assets.allPlatforms}</option>
            {platformNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </PlatformSelectFrame>
        <button type="button" className="btn btn-secondary toolbar-end" onClick={actions.setReturns}>
          <Percent size={14} aria-hidden />
          {t.assets.setExpectedReturns}
        </button>
      </div>

      {/* Class chips */}
      <div className="chips">
        {[ALL, ...availableAssetClasses].map((opt) => (
          <button key={opt} type="button" className="chip" onClick={() => update({ assetClass: opt })} aria-pressed={table.assetClass === opt}>
            {opt !== ALL && <span className="class-dot" style={{ background: classLook(opt).color }} aria-hidden />}
            {opt === ALL ? t.common.all : opt}
          </button>
        ))}
      </div>

      {table.platform !== ALL && <PlatformBar name={table.platform} />}

      {/* Holdings table */}
      <div className="card elev-sm" style={{ padding: '6px 16px 12px', overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <EmptyState
            title={t.assets.noMatch}
            action={
              <button className="btn btn-secondary" onClick={() => setAssetsTable({ ...INITIAL_ASSETS_TABLE, sort: table.sort })}>
                {t.assets.showAll}
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map(({ key, optional }) => {
                  const active = table.sort.key === key;
                  const SortIcon = active ? (table.sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <th
                      key={key}
                      className={optional ? OPTIONAL : undefined}
                      aria-sort={active ? (table.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <button type="button" className="th-sort" onClick={() => update({ sort: toggleSort(table.sort, key) })}>
                        {t.assets.columns[key]}
                        <SortIcon size={13} aria-hidden style={{ opacity: active ? 1 : 0.4 }} />
                      </button>
                    </th>
                  );
                })}
                {/* The share of all assets: sorts like Value, so it has no sort of its own. */}
                <th className={OPTIONAL}>{t.assets.columns.share}</th>
                <th className="col-actions" style={{ width: '48px' }}>
                  <span className="sr-only">{t.common.actions}</span>
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
                    <button
                      type="button"
                      className="link-btn text-muted with-avatar"
                      title={t.assets.showOnly(h.platform)}
                      onClick={() => openPlatform(h.platform)}
                    >
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
                  <td style={{ padding: '6px', textAlign: 'right' }}>
                    <HoldingRowActions holding={h} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={COLUMNS.length + 2} className="table-total">
                  {t.assets.total(rows.length, formatCurrency(shownTotal))}
                  {filtered && t.assets.ofYourAssets(pctOf(shownTotal, totalAssets))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
