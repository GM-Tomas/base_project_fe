'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** While true (saving, say), Escape and the backdrop leave it open, so the outcome isn't lost. */
  busy?: boolean;
  /** Where focus goes when it opens: the first control otherwise. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

// Every dialog of the app: a portal over the page, announced as a modal dialog named by its title. Focus
// moves in when it opens, stays inside (Tab cycles), and goes back to what opened it when it closes.
export function Modal({ title, onClose, children, busy = false, initialFocusRef, className }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // A click only closes it if the press started on the backdrop too: selecting text in a field and letting
  // go outside the dialog mustn't throw the form away.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    (initialFocusRef?.current ?? dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
    // Only when it opens: what has focus later is the user's business.
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const [first, last] = [focusable[0], focusable[focusable.length - 1]];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOnBackdrop.current && !busy) onClose();
        pressedOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className={className ? `dialog ${className}` : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
