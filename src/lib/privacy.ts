import { useSyncExternalStore } from 'react';

// The privacy mode: amounts on screen become "$•••••" (percentages stay). It's kept per device, not per
// account: it's about where you are. The money formatters ask it, so an amount inside a sentence is hidden
// too; what's typed into a field isn't (it has to be seen to be typed).

const KEY = 'base.hideAmounts';
export const HIDDEN_AMOUNT = '$•••••';
export const HIDDEN_COMPACT = '$•••';

const listeners = new Set<() => void>();
// Read on first use (there's no storage on the server); kept in step with the other tabs.
let hidden: boolean | null = null;

function stored(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether amounts are hidden right now. */
export function amountsHidden(): boolean {
  if (hidden === null) hidden = stored();
  return hidden;
}

export function setAmountsHidden(next: boolean) {
  hidden = next;
  try {
    if (next) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Hidden for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    hidden = stored();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Whether amounts are hidden, re-rendering when that changes (here or in another tab). */
export function useAmountsHidden(): boolean {
  return useSyncExternalStore(subscribe, amountsHidden, () => false);
}
