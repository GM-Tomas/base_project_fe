'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { formatCurrency, formatPercentage } from '@/lib/calculations';
import { ASSET_CLASS_TAG_CLASSES } from '@/lib/constants';

export const PlatformsView: React.FC = () => {
  const {
    platformDistribution,
    selectedPlatform,
    setSelectedPlatform,
    selectedPlatformHoldings,
    currency,
    fxRate,
  } = useWealth();

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
          return (
            <div
              key={p.name}
              onClick={() => setSelectedPlatform(isSelected ? null : p.name)}
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
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    flex: 'none',
                    background: `color-mix(in srgb, ${p.color} 25%, var(--color-surface))`,
                    color: p.color,
                  }}
                >
                  {p.initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: '15px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--color-text)',
                    }}
                  >
                    {p.name}
                  </div>
                  <span className={p.tagClass} style={{ marginTop: '2px' }}>
                    {p.type}
                  </span>
                </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="card-kicker" style={{ margin: 0, flex: 1 }}>
              {selectedPlatform} · what&apos;s there
            </div>
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
                    <th>Qty</th>
                    <th>Value</th>
                    <th>24h</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlatformHoldings.map((h) => {
                    const isUp = h.change > 0;
                    const isDown = h.change < 0;
                    const changeColor = isUp
                      ? 'var(--color-positive)'
                      : isDown
                      ? 'var(--color-negative)'
                      : 'var(--color-neutral-400)';
                    const changeIcon = isUp ? '▲ ' : isDown ? '▼ ' : '– ';
                    const tagClass = ASSET_CLASS_TAG_CLASSES[h.cls] || 'tag tag-neutral';

                    return (
                      <tr key={h.id}>
                        <td style={{ padding: '12px 10px', fontWeight: 500 }}>{h.name}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span className={tagClass}>{h.cls}</span>
                        </td>
                        <td style={{ padding: '12px 10px' }} className="text-muted">
                          {h.qty !== null ? h.qty.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '—'}
                        </td>
                        <td style={{ padding: '12px 10px' }} className="text-nowrap">
                          {formatCurrency(h.value, currency, fxRate)}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span
                            style={{
                              color: changeColor,
                              fontSize: '13px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {changeIcon}
                            {formatPercentage(h.change)}
                          </span>
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
