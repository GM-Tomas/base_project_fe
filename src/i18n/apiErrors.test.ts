import { describe, expect, it } from 'vitest';
import { translateApiMessage } from './apiErrors';

// What the API (and the mock, which says the same) answers when it refuses something a user can do.
const SAID = [
  'Your session expired. Please sign in again.',
  'Invalid login credentials',
  'Email not confirmed',
  'Platform not found',
  'Asset class not found',
  'Malformed JSON body',
  'Name is required',
  'Platform is required',
  'Asset class is required',
  'AssetClass must not be blank',
  'Value is required',
  'Value must not be negative',
  'Value must be a number',
  'Value is too large',
  'Amount is too large',
  'amount must be greater than 0',
  "fee can't be larger than the amount",
  'Balance is required',
  'Balance must not be negative',
  'Balance is too large',
  'Monthly payment must not be negative',
  'Monthly payment is too large',
  'Pick a different destination',
  'A payment can only lower the balance',
  'New charges and interest can only raise the balance',
  "occurredAt can't be in the future or before 1970",
  'capturedAt must be in the past, from 1970 on',
  'color must be a hex color like #1a2b3c',
  'textColor must be a hex color like #1a2b3c',
  'avatarText must be 1 or 2 characters (an emoji counts as one)',
  'expectedReturnPct must be between -100 and 100',
  'interestRatePct must be between 0 and 200',
  'dueDay must be between 1 and 31',
  "Adding or removing a debt can't be undone here: remove it, or add it again.",
  "Adding or removing an asset can't be undone here: remove it, or add it again.",
  "Bitcoin is worth $17,000.50: a loss can't be larger than that.",
  "Bitcoin is worth $17,000.50: you can't withdraw more than that.",
  "USD cash is worth $500.00: you can't transfer more than that.",
  "Emergency fund is worth $200.00: you can't pay more than that.",
  'Emergency fund is worth $50.00: undoing this would take it below zero.',
  'Visa Gold has $20.00 left to pay: undoing this would take it below zero.',
  'Visa Gold only has $1,120.50 left to pay.',
  "Bitcoin was removed, so this can't be undone.",
  "You've reached the limit of 20000 recorded changes. Undo some to record new ones.",
  "You've reached the limit of 5000 snapshots.",
  'A snapshot already exists for 2026-10-04T10:00:00Z',
  'You can set up to 100 asset classes. Remove one to add another.',
  'You can track up to 1000 holdings. Remove one to add another.',
  'You can track up to 200 debts. Remove one to add another.',
  'You can customize up to 1000 platforms. Reset one to customize another.',
  'There\'s already a class named "Crypto"',
  'There\'s already a platform named "Binance"',
  'Crypto still has assets: say which class they move to (moveTo)',
  'Holding h1 not found',
  'Debt d1 not found',
  'Movement m1 not found',
  'Snapshot s1 not found',
  'Name must be at most 120 characters',
  'type must be at most 40 characters',
  'Note exceeds max length (201 > 200)',
  'Notes exceeds max length (501 > 500)',
  'Debt name exceeds max length (121 > 120)',
  'Lender exceeds max length (121 > 120)',
  'Request failed with status 502',
];

describe("the API's messages", () => {
  it('come as they are in English', () => {
    for (const message of SAID) expect(translateApiMessage(message, 'en')).toBe(message);
  });

  it('are all said in Spanish, names and amounts kept', () => {
    const untranslated = SAID.filter((message) => translateApiMessage(message, 'es') === message);
    expect(untranslated).toEqual([]);
    expect(translateApiMessage("Bitcoin is worth $17,000.50: you can't withdraw more than that.", 'es')).toBe(
      'Bitcoin vale $17,000.50: no podés retirar más que eso.',
    );
    expect(translateApiMessage('There\'s already a platform named "Binance"', 'es')).toBe('Ya hay una plataforma llamada "Binance"');
    expect(translateApiMessage('Holding h1 not found', 'es')).toBe('No se encontró el activo');
    expect(translateApiMessage('Lender exceeds max length (121 > 120)', 'es')).toBe('El acreedor puede tener hasta 120 caracteres');
  });

  it('are translated one by one when several come together, and one not known stays in English', () => {
    expect(translateApiMessage('Name is required; Value must not be negative; something new', 'es')).toBe(
      'El nombre es obligatorio; El valor no puede ser negativo; something new',
    );
  });
});
