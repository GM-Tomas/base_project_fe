// Text as search compares it: accents and case ignored, so "cafe" finds "Café" and "BINANCE" finds "Binance".
export const normalizeForSearch = (text: string) => text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();

/** Whether every word of the query appears somewhere in the fields (in any order). */
export function matchesQuery(query: string, fields: string[]): boolean {
  const haystack = normalizeForSearch(fields.join(' '));
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
