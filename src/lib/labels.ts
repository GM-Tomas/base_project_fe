// How the API reads names it's given (holdings, platforms, classes): trimmed, inner whitespace collapsed, in
// Unicode NFC. Used by the UI to tell an existing platform or class from a new one, and by the mock API.
export const normalizeLabel = (raw: string) => raw.trim().replace(/[\t\n\f\r ]+/g, ' ').normalize('NFC');

// Two platform names are one platform if they match caselessly in any Unicode form (close to the API's full
// case folding): "Binance" and "binance", "Café" typed either way.
export const platformKey = (name: string) =>
  normalizeLabel(name).normalize('NFD').toUpperCase().toLowerCase().normalize('NFD');
