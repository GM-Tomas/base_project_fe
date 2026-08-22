'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';

export const AddAssetModal: React.FC = () => {
  const { isAddModalOpen, closeAddModal, addHolding, platforms, availableAssetClasses } = useWealth();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState(platforms[0]?.name || '');
  const [assetClass, setAssetClass] = useState(availableAssetClasses[0] || '');
  const [value, setValue] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');

  if (!isAddModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter an asset name');
      return;
    }
    if (!platform.trim()) {
      setError('Please enter a platform');
      return;
    }
    if (!assetClass.trim()) {
      setError('Please enter an asset class');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Please enter a valid positive value');
      return;
    }
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    addHolding({
      name: name.trim(),
      cls: assetClass.trim(),
      platform: platform.trim(),
      qty: numQty,
      value: numValue,
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
              <input
                className="input"
                type="text"
                list="platform-suggestions"
                placeholder="e.g. Balanz"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                required
              />
              <datalist id="platform-suggestions">
                {platforms.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label>Asset class</label>
              <input
                className="input"
                type="text"
                list="asset-class-suggestions"
                placeholder="e.g. Equity"
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value)}
                required
              />
              <datalist id="asset-class-suggestions">
                {availableAssetClasses.map((cls) => (
                  <option key={cls} value={cls} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field">
              <label>Value</label>
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
              <label>Quantity</label>
              <input
                className="input"
                type="number"
                step="any"
                placeholder="e.g. 10.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
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
