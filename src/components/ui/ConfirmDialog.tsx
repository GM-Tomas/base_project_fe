'use client';

import React, { useRef, useState } from 'react';
import { Modal } from './Modal';
import { FormError } from './FormError';
import { errorMessage } from '@/lib/apiError';
import { useT } from '@/lib/i18n';

export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while it works ("Removing…"). */
  busyLabel: string;
  tone?: 'danger' | 'primary';
  /** Shown when it fails without the API saying why (a network error); "Something went wrong" otherwise. */
  failureMessage?: string;
  /** Does the work; a rejection keeps the dialog open with the error. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// Asks before doing something that can't be taken back. Cancel has the focus, so Enter doesn't confirm by
// accident; a failure is reported inside, with nothing done.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  tone = 'danger',
  failureMessage,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(errorMessage(e, failureMessage ?? t.common.somethingWrong));
      setBusy(false);
      return;
    }
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose} busy={busy} initialFocusRef={cancelRef}>
      <div className="dialog-text">{message}</div>
      {error && <FormError>{error}</FormError>}
      <div className="dialog-actions">
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </button>
        <button type="button" className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} onClick={confirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
