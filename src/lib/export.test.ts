import { describe, expect, it, vi } from 'vitest';
import type { Debt, Movement, Snapshot } from '@/types/wealth';
import { activityCsv, allMovements, checkpointsCsv, csvCell, debtsCsv, exportName, toCsv } from './export';

describe('CSV', () => {
  it('quotes what needs it and keeps formulas as text', () => {
    expect(csvCell('Plain')).toBe('Plain');
    expect(csvCell('Gold, bars')).toBe('"Gold, bars"');
    expect(csvCell('The "good" one')).toBe('"The ""good"" one"');
    expect(csvCell('Two\nlines')).toBe('"Two\nlines"');
    // A spreadsheet would run these.
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+54 11 5555')).toBe("'+54 11 5555");
    expect(csvCell('-ish')).toBe("'-ish");
    expect(csvCell('@home')).toBe("'@home");
    expect(csvCell('=1,2')).toBe(`"'=1,2"`);
    // Numbers as they are; nothing for what's not there.
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('writes a BOM, a header and CRLF lines', () => {
    expect(toCsv(['A', 'B'], [[1, 'x'], [null, 'y, z']])).toBe('﻿A,B\r\n1,x\r\n,"y, z"\r\n');
  });

  it('lays out debts, activity and checkpoints', () => {
    const debt = {
      name: 'Visa', lender: 'Santander', kind: 'CREDIT_CARD', balanceUsd: 1250.4, interestRatePct: 65, monthlyPaymentUsd: 300,
      dueDay: 10, notes: 'Closes on the 3rd', createdAt: '2026-01-10T12:00:00Z',
    } as Debt;
    expect(debtsCsv([debt]).split('\r\n').slice(0, 2)).toEqual([
      '﻿Name,Lender,Kind,Balance (USD),Rate (% a year),Monthly payment (USD),Due day,Notes,Added',
      'Visa,Santander,Credit card,1250.4,65,300,10,Closes on the 3rd,2026-01-10T12:00:00Z',
    ]);

    const holding = (name: string, platform: string) => ({ id: name, name, platform, assetClass: 'Cash', exists: true });
    const transfer = {
      kind: 'TRANSFER', occurredAt: '2026-03-01T12:00:00Z', amountUsd: 100, feeUsd: 2, holding: holding('Savings', 'Santander'),
      toHolding: holding('Fund', 'Mercado Pago'), debt: null, previousValueUsd: null, newValueUsd: null, note: 'Rent, March',
    } as unknown as Movement;
    const payment = {
      kind: 'DEBT_PAYMENT', occurredAt: '2026-03-02T12:00:00Z', amountUsd: 300, feeUsd: null, holding: null, toHolding: null,
      debt: { id: 'd1', name: 'Visa', lender: null, exists: true }, previousValueUsd: 1550.4, newValueUsd: 1250.4, note: null,
    } as unknown as Movement;
    expect(activityCsv([transfer, payment]).split('\r\n').slice(1, 3)).toEqual([
      '2026-03-01T12:00:00Z,Transfer,Savings,Santander,Fund,Mercado Pago,,100,2,,,"Rent, March"',
      '2026-03-02T12:00:00Z,Payment,,,,,Visa,300,,1550.4,1250.4,',
    ]);

    const manual = { capturedAt: '2025-12-31T12:00:00Z', totalValueUsd: -2500, assetsUsd: 0, debtsUsd: 2500, source: 'MANUAL', note: 'From a sheet' } as Snapshot;
    expect(checkpointsCsv([manual]).split('\r\n')[1]).toBe('2025-12-31T12:00:00Z,-2500,0,2500,Yes,From a sheet');
  });

  it('names files by what they are and the day', () => {
    expect(exportName('export', 'json', new Date(2026, 9, 6, 23, 30))).toBe('base-export-2026-10-06.json');
  });
});

describe('allMovements', () => {
  it('reads every page, 200 at a time, from where the last one ended', async () => {
    const getMovements = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'm3' }, { id: 'm2' }], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [{ id: 'm1' }], nextCursor: null });
    const items = await allMovements({ getMovements });
    expect(items.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
    expect(getMovements.mock.calls).toEqual([[{ limit: 200, cursor: undefined }], [{ limit: 200, cursor: 'c1' }]]);
  });
});
