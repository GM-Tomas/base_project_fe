import { useSyncExternalStore } from 'react';

/** Up to this width, the app is laid out for a phone: a bottom bar instead of the sidebar. */
export const NARROW = '(max-width: 900px)';

const matches = (query: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

/** Whether the window matches a media query, now and as it changes (false where there's no matchMedia). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matches(query),
    () => false,
  );
}
