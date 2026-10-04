const firstCharacter = (text: string): string | undefined =>
  new Intl.Segmenter().segment(text)[Symbol.iterator]().next().value?.segment;

// The first character of a name as a person sees it: a flag, an emoji with its skin tone, a letter with
// its accent. Capitalized when that keeps it one character ("ß" stays "ß" rather than becoming "SS").
export function initialOf(name: string): string {
  const first = firstCharacter(name.trim());
  if (!first) return '?';
  const upper = first.toUpperCase();
  return firstCharacter(upper) === upper ? upper : first;
}
