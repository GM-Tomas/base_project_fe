'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { AssetClass, Currency } from '@/types/wealth';
import { ASSET_CLASS_OPTIONS, CURRENCY_OPTIONS } from '@/lib/constants';

export const AddAssetModal: React.FC = () => {
  const { isAddModalOpen, closeAddModal, addHolding, platforms } = useWealth();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState(platforms[0]?.name || 'Balanz');
  const [assetClass, setAssetClass] = useState<AssetClass>('Equity');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');

  if (!isAddModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter an asset name');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Please enter a valid positive value');
      return;
    }

    addHolding({
      name: name.trim(),
      cls: assetClass,
      platform,
      qty: quantity ? parseFloat(quantity) : null,
      value: numValue,
      currency,
      change: 0,
    });

    // Reset and close
    setName('');
    setValue('');
    setQuantity('');
    setError('');
    closeAddModal();
  };

  return (
    <div className="dialog-backdrop" onClick={closeAddModal}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Add an asset</div>
        
        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, var(--color-negative) 18%, transparent)',
              color: 'var(--color-negative)',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="field">
            <label>Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Vanguard S&P 500 ETF"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field">
              <label>Platform</label>
              <select
                className="input"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {platforms.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Asset class</label>
              <select
                className="input"
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
              >
                {ASSET_CLASS_OPTIONS.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field">
              <label>Value (USD)</label>
              <input
                className="input"
                type="number"
                step="any"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Native currency</label>
              <select
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCY_OPTIONS.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Quantity (Optional)</label>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="e.g. 10.5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={closeAddModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
