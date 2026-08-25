'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency } from '@/lib/calculations';
import { ASSET_CLASS_TAG_CLASSES } from '@/lib/constants';
import { ApiError } from '@/lib/api';

export const AssetsView: React.FC = () => {
  const {
    filteredHoldings,
    assetFilter,
    setAssetFilter,
    availableAssetClasses,
    deleteHolding,
  } = useWealth();
  const [error, setError] = useState('');

  const filterOptions = ['All', ...availableAssetClasses];

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await deleteHolding(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove this asset');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ fontSize: '13px', color: 'var(--color-negative)' }}>{error}</div>
      )}

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => {
          const isActive = assetFilter === opt;
          return (
            <button
              key={opt}
              onClick={() => setAssetFilter(opt)}
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
        <table className="table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Class</th>
              <th>Platform</th>
              <th>Value</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-neutral-400)' }}>
                  No holdings found for the selected category.
                </td>
              </tr>
            ) : (
              filteredHoldings.map((h) => {
                const tagClass = ASSET_CLASS_TAG_CLASSES[h.assetClass] || 'tag tag-neutral';

                return (
                  <tr key={h.id}>
                    <td style={{ padding: '12px 10px', fontWeight: 500 }}>{h.name}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className={tagClass}>{h.assetClass}</span>
                    </td>
                    <td style={{ padding: '12px 10px' }} className="text-muted">
                      {h.platform}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 500 }} className="text-nowrap">
                      {formatCurrency(h.valueUsd)}
                    </td>
                    <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                      <button
                        title="Remove asset"
                        onClick={() => handleDelete(h.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-neutral-600)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-negative)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-neutral-600)')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
