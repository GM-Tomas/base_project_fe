import { describe, expect, it } from 'vitest';
import { initialOf } from './initial';

describe('initialOf', () => {
  it.each([
    ['Balanz', 'B'],
    ['binance', 'B'],
    ['  émile', 'É'],
    ['Émile', 'É'],
    ['\u{1F1E6}\u{1F1F7} Balanz', '\u{1F1E6}\u{1F1F7}'],
    ['\u{1F44D}\u{1F3FD} ok', '\u{1F44D}\u{1F3FD}'],
    ['\u{1F468}‍\u{1F469}‍\u{1F467} family', '\u{1F468}‍\u{1F469}‍\u{1F467}'],
    ['ßtraße', 'ß'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %j', (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });
});
