'use client';

import React from 'react';
import { ArrowLeftRight, Paintbrush, Plus } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import { sumValues } from '@/lib/assetsTable';
import { ClassTag } from '@/components/ui/ClassTag';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { PlatformCustomizeDialog } from '@/components/settings/PlatformCustomizeDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useHoldingActions } from '@/components/dialogs/useHoldingActions';
import { HoldingRowActions } from '@/components/dialogs/HoldingRowActions';
import { useOpenFromRow, useOpenHolding } from '@/components/dialogs/HoldingDrawer';

export const PlatformsView: React.FC = () => {
  const {
    platformDistribution,
    selectedPlatform,
    setSelectedPlatform,
    selectedPlatformHoldings,
    platforms,
  } = useWealth();
  const { openDialog } = useUi();
  const customize = (name: string) => {
    const platform = platforms.find((p) => p.name === name);
    if (platform) openDialog((close) => <PlatformCustomizeDialog platform={platform} onClose={close} />);
  };
  const actions = useHoldingActions();
  const openHolding = useOpenHolding();
  const openFromRow = useOpenFromRow();

  if (platformDistribution.length === 0) {
    return (
      <div className="card elev-sm">
        <EmptyState
          title="Platforms appear as you add assets"
          action={
            <button className="btn btn-primary" onClick={() => actions.add()}>
              Add your first asset
            </button>
          }
        >
          Each bank, broker, exchange or wallet you name when adding an asset gets its card here, with what you hold
          there.
        </EmptyState>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Platforms Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '14px',
        }}
      >
        {platformDistribution.map((p) => {
          const isSelected = selectedPlatform === p.name;
          const toggle = () => setSelectedPlatform(isSelected ? null : p.name);
          return (
            <div
              key={p.name}
              // The name is the card's button; a click anywhere else on it does the same.
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button')) toggle();
              }}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 16px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 1.5px var(--color-accent)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PlatformAvatar text={p.initial} color={p.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    className="card-name-btn"
                    aria-pressed={isSelected}
                    aria-label={`${p.name}: show what's there`}
                    onClick={toggle}
                  >
                    {p.name}
                  </button>
                  <span className={p.tagClass} style={{ marginTop: '2px' }}>
                    {p.type}
                  </span>
                </div>
                <IconButton label={`Customize ${p.name}`} onClick={() => customize(p.name)}>
                  <Paintbrush size={15} aria-hidden />
                </IconButton>
                <IconButton label={`Transfer from ${p.name}`} onClick={() => actions.transfer({ platform: p.name })}>
                  <ArrowLeftRight size={15} aria-hidden />
                </IconButton>
              </div>

              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '16px',
                  color: 'var(--color-text)',
                }}
              >
                {p.balanceFormatted}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                  marginTop: '2px',
                }}
              >
                {p.pctLabel} of what you own
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Platform Drilldown Card */}
      {selectedPlatform && (
        <div className="card elev-md" style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-kicker" style={{ margin: 0 }}>
                {selectedPlatform} · what&apos;s there
              </div>
              <div className="text-muted" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                {selectedPlatformHoldings.length} {selectedPlatformHoldings.length === 1 ? 'asset' : 'assets'} ·{' '}
                {formatCurrency(sumValues(selectedPlatformHoldings))}
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => actions.add(selectedPlatform)}>
              <Plus size={14} aria-hidden />
              Add asset here
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => actions.transfer({ platform: selectedPlatform })}
              disabled={selectedPlatformHoldings.length === 0}
            >
              <ArrowLeftRight size={14} aria-hidden />
              Transfer from here
            </button>
            <button className="btn btn-ghost" onClick={() => setSelectedPlatform(null)}>
              Close
            </button>
          </div>

          {selectedPlatformHoldings.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: '13px' }}>
              No individual holdings recorded for this platform yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Class</th>
                    <th>Value</th>
                    <th style={{ width: '132px' }}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlatformHoldings.map((h) => {
                    return (
                      <tr key={h.id} className="row-clickable" onClick={(e) => openFromRow(e, h)}>
                        <td style={{ padding: '12px 10px', fontWeight: 500 }}>
                          <button type="button" className="link-btn" data-holding-name onClick={() => openHolding(h)}>
                            {h.name}
                          </button>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <ClassTag name={h.assetClass} />
                        </td>
                        <td style={{ padding: '12px 10px' }} className="text-nowrap">
                          {formatCurrency(h.valueUsd)}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <HoldingRowActions holding={h} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
