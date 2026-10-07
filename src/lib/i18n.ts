import { useSyncExternalStore } from 'react';
import { en, type Messages } from '@/i18n/en';
import { es } from '@/i18n/es';

// The app's language. The account keeps it (Preferences); this device keeps a copy, so the app opens in it
// before the account's preferences load, and the sign-in screen has one too. "auto" is the browser's. Like the
// privacy mode, the formatters ask it, so text built outside React follows it as well.

export type Language = 'en' | 'es';
export type LanguageSetting = 'auto' | Language;
export const LANGUAGE_SETTINGS: LanguageSetting[] = ['auto', 'en', 'es'];

const KEY = 'base.language';
const DICTIONARIES: Record<Language, Messages> = { en, es };
// Spanish as written in Argentina: 1.234,56 and "15 ene 2026".
const INTL: Record<Language, string> = { en: 'en-US', es: 'es-AR' };

const listeners = new Set<() => void>();
let setting: LanguageSetting | null = null;

const browserLanguage = (): Language =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';

function stored(): LanguageSetting {
  try {
    const value = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    return value === 'en' || value === 'es' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** What this device is set to: a language, or auto. */
export function languageSetting(): LanguageSetting {
  if (setting === null) setting = stored();
  return setting;
}

/** The language the app is in right now. */
export function language(): Language {
  const current = languageSetting();
  return current === 'auto' ? browserLanguage() : current;
}

export function setLanguageSetting(next: LanguageSetting) {
  if (next === languageSetting()) return;
  setting = next;
  try {
    if (next === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // In this language for this visit only.
  }
  listeners.forEach((listener) => listener());
}

/** The dictionary of the language the app is in: for text built outside a component. */
export const messages = (): Messages => DICTIONARIES[language()];

/** The locale the numbers and dates are written in (Intl's). */
export const intlLocale = () => INTL[language()];

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    setting = stored();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The language the app is in, re-rendering when it changes (here or in another tab). */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, language, () => 'en');
}

/** The dictionary of the language the app is in, re-rendering when it changes. */
export function useT(): Messages {
  return DICTIONARIES[useLanguage()];
}
