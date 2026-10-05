'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const TOAST_MS = 5000;

export interface ToastAction {
  label: string;
  onClick: () => unknown;
}

export interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  message: string;
  action?: ToastAction;
}

// Toasts stack in the bottom-right corner. Success toasts are read politely, errors right away; both regions
// are always there, so screen readers notice what's added to them.
export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const list = (tone: ToastItem['tone']) =>
    toasts.filter((t) => t.tone === tone).map((t) => <Toast key={t.id} toast={t} onDismiss={onDismiss} />);
  return createPortal(
    <div className="toast-region">
      <div role="status" aria-live="polite">
        {list('success')}
      </div>
      <div role="alert">{list('error')}</div>
    </div>,
    document.body,
  );
}

// Gone after TOAST_MS, unless the pointer or the keyboard is on it (reaching its Undo with Tab mustn't race
// the timer): it waits, then gets the full time again.
function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            onDismiss(toast.id);
            void toast.action!.onClick();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="icon-btn" aria-label="Dismiss" title="Dismiss" onClick={() => onDismiss(toast.id)}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
