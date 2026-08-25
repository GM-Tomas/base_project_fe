'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { ApiError } from '@/lib/api';

const NEW_OPTION = '__new__';

export const AddAssetModal: React.FC = () => {
  const { isAddModalOpen, closeAddModal, addHolding, platforms, availableAssetClasses } = useWealth();

  const [name, setName] = useState('');
  const [platform, setPlatform] = useState(platforms[0]?.name || '');
  const [newPlatform, setNewPlatform] = useState('');
  const [assetClass, setAssetClass] = useState(availableAssetClasses[0] || '');
  const [newAssetClass, setNewAssetClass] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isAddModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPlatform = platform === NEW_OPTION ? newPlatform.trim() : platform.trim();
    const finalAssetClass = assetClass === NEW_OPTION ? newAssetClass.trim() : assetClass.trim();

    if (!name.trim()) {
      setError('Please enter an asset name');
      return;
    }
    if (!finalPlatform) {
      setError('Please choose or enter a platform');
      return;
    }
    if (!finalAssetClass) {
      setError('Please choose or enter an asset class');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Please enter a valid positive value');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await addHolding({
        name: name.trim(),
        assetClass: finalAssetClass,
        platform: finalPlatform,
        valueUsd: numValue,
      });

      // Reset and close
      setName('');
      setValue('');
      setNewPlatform('');
      setNewAssetClass('');
      closeAddModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this asset. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
                required
              >
                {platforms.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
                <option value={NEW_OPTION}>+ Add new platform...</option>
              </select>
              {platform === NEW_OPTION && (
                <input
                  className="input"
                  type="text"
                  placeholder="New platform name"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  autoFocus
                  required
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>

            <div className="field">
              <label>Asset class</label>
              <select
                className="input"
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value)}
                required
              >
                {availableAssetClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
                <option value={NEW_OPTION}>+ Add new asset class...</option>
              </select>
              {assetClass === NEW_OPTION && (
                <input
                  className="input"
                  type="text"
                  placeholder="New asset class name"
                  value={newAssetClass}
                  onChange={(e) => setNewAssetClass(e.target.value)}
                  autoFocus
                  required
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>
          </div>

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

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={closeAddModal} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
