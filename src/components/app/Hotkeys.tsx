'use client';

import { useLayoutEffect, useRef } from 'react';
import { useQuickActions, type QuickActions } from './useQuickActions';

const KEYS: Record<string, keyof QuickActions> = {
  n: 'asset',
  g: 'gainLoss',
  t: 'transfer',
  d: 'debt',
  s: 'checkpoint',
  '/': 'searchAssets',
  h: 'togglePrivacy',
  '?': 'shortcuts',
};

// Fields where a letter is typed (or picks an option), not a shortcut.
const TEXT_INPUTS = new Set(['', 'text', 'search', 'email', 'password', 'number', 'tel', 'url', 'date', 'month', 'week', 'time', 'datetime-local']);
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  return target.tagName === 'INPUT' && TEXT_INPUTS.has((target.getAttribute('type') ?? '').toLowerCase());
}

// The keyboard shortcuts (see ShortcutsDialog): not while typing in a field, nor with a dialog or a menu
// open, nor with Ctrl, ⌘ or Alt (those are the browser's).
export function Hotkeys() {
  const actions = useQuickActions();
  const latest = useRef(actions);
  // Layout effects: listening (with what's on screen) from the very commit that paints the app, so a key
  // pressed right as it shows isn't lost. A passive effect can run a moment later.
  useLayoutEffect(() => {
    latest.current = actions;
  });

  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const action = KEYS[e.key.length === 1 ? e.key.toLowerCase() : ''];
      if (!action) return;
      e.preventDefault();
      void latest.current[action]();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
