'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useQuickActions } from '@/components/app/useQuickActions';

interface Item {
  label: string;
  /** Its keyboard shortcut. */
  shortcut?: string;
  run: () => void;
  /** Why it can't be done now (it's disabled then). */
  unavailable?: string;
}

// The header's New ▾: what can be added or recorded from anywhere, with the key that does it. Arrow keys,
// Home and End move through it; Escape closes it.
export function NewMenu() {
  const { holdings, debts } = useWealth();
  const actions = useQuickActions();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const noAssets = holdings.length ? undefined : 'Add an asset first';

  const groups: Item[][] = [
    [
      { label: 'Asset', shortcut: 'N', run: actions.asset },
      { label: 'Gain or loss', shortcut: 'G', run: actions.gainLoss, unavailable: noAssets },
      { label: 'Transfer', shortcut: 'T', run: actions.transfer, unavailable: noAssets },
      { label: 'Debt', shortcut: 'D', run: actions.debt },
      { label: 'Debt payment', run: actions.debtPayment, unavailable: debts.length ? undefined : 'No debts yet' },
      { label: 'Checkpoint', shortcut: 'S', run: () => void actions.checkpoint() },
    ],
    [{ label: 'Keyboard shortcuts', shortcut: '?', run: actions.shortcuts }],
  ];

  const enabled = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
  useEffect(() => {
    if (!open) return;
    enabled()[0]?.focus();
    const closeOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (item: Item) => {
    // The dialog it opens gives the focus back to New when it closes.
    close();
    item.run();
  };
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = enabled();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next: Record<string, () => number> = {
      ArrowDown: () => (at + 1) % items.length,
      ArrowUp: () => (at - 1 + items.length) % items.length,
      Home: () => 0,
      End: () => items.length - 1,
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (next[e.key]) {
      e.preventDefault();
      items[next[e.key]()]?.focus();
    }
  };

  return (
    <div className="new-menu">
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-primary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Plus size={14} strokeWidth={2.2} aria-hidden />
        New
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="menu" role="menu" aria-label="New" onKeyDown={onMenuKeyDown}>
          {groups.map((group, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="menu-separator" role="separator" />}
              {group.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  disabled={Boolean(item.unavailable)}
                  title={item.unavailable}
                  aria-keyshortcuts={item.shortcut}
                  tabIndex={-1}
                  onClick={() => choose(item)}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd aria-hidden>{item.shortcut}</kbd>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
