// One segmenter for every call, made on first use. Browsers without Intl.Segmenter (Firefox before 125)
// get the first code point instead: whole, if not always the whole character.
let segmenter: Intl.Segmenter | null | undefined;

function firstCharacter(text: string): string | undefined {
  if (segmenter === undefined) segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
  return segmenter ? segmenter.segment(text)[Symbol.iterator]().next().value?.segment : Array.from(text)[0];
}

// The first character of a name as a person sees it: a flag, an emoji with its skin tone, a letter with
// its accent. Capitalized when that keeps it one character ("ß" stays "ß" rather than becoming "SS").
export function initialOf(name: string): string {
  const first = firstCharacter(name.trim());
  if (!first) return '?';
  const upper = first.toUpperCase();
  return firstCharacter(upper) === upper ? upper : first;
}
