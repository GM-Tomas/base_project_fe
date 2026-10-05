'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { formatCurrency } from '@/lib/calculations';
import { assetClassTag } from '@/lib/constants';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { HoldingFormDialog } from '@/components/dialogs/HoldingFormDialog';
import type { Holding } from '@/types/wealth';

export const AssetsView: React.FC = () => {
  const {
    holdings,
    filteredHoldings,
    assetFilter,
    setAssetFilter,
    availableAssetClasses,
    deleteHolding,
  } = useWealth();
  const { openDialog, toast } = useUi();

  const filterOptions = ['All', ...availableAssetClasses];

  const confirmRemove = (h: Holding) =>
    openDialog((close) => (
      <ConfirmDialog
        title="Remove asset?"
        message={`${h.name} on ${h.platform} (${formatCurrency(h.valueUsd)}) will stop counting toward your net worth.`}
        confirmLabel="Remove"
        busyLabel="Removing…"
        failureMessage="Could not remove this asset. Please try again."
        onClose={close}
        onConfirm={async () => {
          await deleteHolding(h.id);
          toast.success('Asset removed');
        }}
      />
    ));

  if (holdings.length === 0) {
    return (
      <div className="card elev-sm">
        <EmptyState
          title="Start by adding what you own"
          action={
            <button className="btn btn-primary" onClick={() => openDialog((close) => <HoldingFormDialog onClose={close} />)}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => {
          const isActive = assetFilter === opt;
          return (
            <button
              key={opt}
              onClick={() => setAssetFilter(opt)}
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

      {/* Holdings Table Card */}
      <div className="card elev-sm" style={{ padding: '6px 16px 16px', overflowX: 'auto' }}>
        {filteredHoldings.length === 0 ? (
          <EmptyState
            title="No assets match this filter"
            action={
              <button className="btn btn-secondary" onClick={() => setAssetFilter('All')}>
                Show all
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Class</th>
                <th>Platform</th>
                <th>Value</th>
                <th style={{ width: '40px' }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => (
                <tr key={h.id}>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }}>{h.name}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={assetClassTag(h.assetClass)}>{h.assetClass}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }} className="text-muted">
                    {h.platform}
                  </td>
                  <td style={{ padding: '12px 10px', fontWeight: 500 }} className="text-nowrap">
                    {formatCurrency(h.valueUsd)}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    <div className="row-actions">
                      <IconButton label={`Remove ${h.name}`} tone="danger" onClick={() => confirmRemove(h)}>
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
