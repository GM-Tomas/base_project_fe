import { amountsHidden, HIDDEN_AMOUNT } from './privacy';
import { intlLocale, messages } from './i18n';

// Amounts as people type them: "1.234,56" in Argentina, "1,234.56" in the US, with or without "$", "US$",
// "USD" or spaces. The API keeps 2 decimals, so amounts are rounded to cents here as it rounds them (half-up,
// on the digits as typed): what the preview shows is what gets stored.

export type ParsedAmount = { value: number; error?: undefined } | { value?: undefined; error: string };


const CURRENCY = /US\$|USD|\$/gi;

// Thousands groups: 1 to 3 digits (no leading zero) followed by groups of exactly 3.
function isGrouped(text: string, separator: string): boolean {
  const [first, ...rest] = text.split(separator);
  return /^[1-9]\d{0,2}$/.test(first) && rest.length > 0 && rest.every((group) => /^\d{3}$/.test(group));
}

// The integer and decimal digits of an amount, or null if the text isn't one.
function splitDigits(text: string): [integer: string, fraction: string] | null {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    // Both separators: the one that comes last is the decimal one.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const at = text.lastIndexOf(decimal);
    const [integer, fraction] = [text.slice(0, at), text.slice(at + 1)];
    if (integer.includes(decimal) || !isGrouped(integer, thousands)) return null;
    return [integer.split(thousands).join(''), fraction];
  }

  const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
  if (separator === null) return [text, ''];
  const parts = text.split(separator);
  if (parts.length > 2) {
    // The same separator more than once: thousands ("1.234.567").
    return isGrouped(text, separator) ? [parts.join(''), ''] : null;
  }
  // Once: thousands when exactly 3 digits follow a proper first group ("1.234", "12,500"), decimal otherwise
  // ("12,5", "0.125", "1234.567").
  return isGrouped(text, separator) ? [parts.join(''), ''] : [parts[0], parts[1]];
}

// Rounds half-up to cents on the digits themselves, so no float error creeps in (1.005 → 1.01).
function toCents(integer: string, fraction: string): number {
  let cents = BigInt((integer || '0') + (fraction + '00').slice(0, 2));
  if ((fraction[2] ?? '0') >= '5') cents += BigInt(1);
  const digits = cents.toString().padStart(3, '0');
  return Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

export function parseAmount(raw: string): ParsedAmount {
  let text = raw.replace(/\s/g, '').replace(CURRENCY, '');
  const negative = /^[-−]/.test(text);
  if (negative) text = text.slice(1);
  if (!/^[\d.,]*\d[\d.,]*$/.test(text)) return { error: messages().amounts.hint };

  const digits = splitDigits(text);
  if (!digits || !/^\d*$/.test(digits[0]) || !/^\d*$/.test(digits[1])) return { error: messages().amounts.hint };
  const value = toCents(...digits);
  if (!Number.isFinite(value)) return { error: messages().amounts.hint };
  if (negative && value !== 0) return { error: messages().amounts.negative };
  return { value };
}

/** formatUsd, also in privacy mode: what goes into a field, or what the user just typed. In the app's language
 * ("$1,234.56", "$1.234,56"): parseAmount reads both. */
export const exactUsd = (value: number) =>
  `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$1,234.56" — with cents, for previews and anywhere an exact amount matters ("$•••••" in privacy mode). */
export const formatUsd = (value: number) => (amountsHidden() ? HIDDEN_AMOUNT : exactUsd(value));

/** An amount that can be below zero (a net worth): "-1,234.56", "−$500", "$-500". */
export function parseSignedAmount(raw: string): ParsedAmount {
  const text = raw.replace(/\s/g, '').replace(CURRENCY, '');
  const negative = /^[-−]/.test(text);
  const parsed = parseAmount(negative ? text.slice(1) : text);
  // A second minus ("--5") is a typo, not a negative amount.
  if (parsed.error !== undefined) return { error: messages().amounts.hint };
  return { value: negative && parsed.value !== 0 ? -parsed.value : parsed.value };
}
