'use client';

import React, { useId, useRef, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import { errorMessage } from '@/lib/apiError';
import type { AssetClassInfo } from '@/types/wealth';

export interface DeleteClassDialogProps {
  assetClass: AssetClassInfo;
  onClose: () => void;
}

// Removing a class: one without assets once confirmed; one with assets moves them to another class first,
// all at once. A default class removed doesn't come back (adding it again does).
export function DeleteClassDialog({ assetClass, onClose }: DeleteClassDialogProps) {
  const { assetClassInfos, deleteAssetClass } = useWealth();
  const { toast } = useUi();
  const selectId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const others = assetClassInfos.filter((c) => c.name !== assetClass.name);
  const count = assetClass.holdingsCount;
  const [moveTo, setMoveTo] = useState(others[0]?.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteAssetClass(assetClass.id, count > 0 ? moveTo : undefined);
    } catch (e) {
      setError(errorMessage(e, 'Could not remove this class. Please try again.'));
      setBusy(false);
      return;
    }
    toast.success(count > 0 ? `${assetClass.name} removed · its assets are in ${moveTo}` : `${assetClass.name} removed`);
    onClose();
  };

  const comesBack = assetClass.isDefault ? ' It won’t come back unless you add it again.' : '';
  return (
    <Modal title={`Remove ${assetClass.name}?`} onClose={onClose} busy={busy} initialFocusRef={cancelRef}>
      {count === 0 ? (
        <div className="dialog-text">It has no assets.{comesBack}</div>
      ) : (
        <>
          <div className="dialog-text">
            {count === 1 ? 'Its asset moves' : `Its ${count} assets move`} to another class, all at once.{comesBack}
          </div>
          <div className="field">
            <label htmlFor={selectId}>Move {count === 1 ? 'its asset' : `its ${count} assets`} to</label>
            <select id={selectId} className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {error && <FormError>{error}</FormError>}
      <div className="dialog-actions">
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={remove} disabled={busy || (count > 0 && !moveTo)}>
          {busy ? 'Removing…' : count > 0 ? 'Move and remove' : 'Remove'}
        </button>
      </div>
    </Modal>
  );
}
