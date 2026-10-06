import { describe, expect, it } from 'vitest';
import type { Holding } from '@/types/wealth';
import { createMockApi } from './mockApi';
import { createMockCustomization } from './mockCustomization';
import { classIdOf, platformIdOf } from './customization';

const at = (iso: string) => () => new Date(iso);
const demo = () => createMockApi(at('2026-10-04T10:00:00Z'));
const all = async (api: ReturnType<typeof demo>) => (await api.getAssetClasses()).all;
const holdingsOf = async (api: ReturnType<typeof demo>, assetClass: string) =>
  (await api.getHoldings()).filter((h) => h.assetClass === assetClass).map((h) => h.name);

// The mock's classes and platforms follow the API's rules (base_project_go AssetClassService, PlatformService).
describe('mock API: classes', () => {
  it('creates a class that shows before it has assets, and refuses one the user has', async () => {
    const api = demo();
    const created = await api.createAssetClass({ name: ' Real   Estate ', color: '#AABBCC', liquid: false, expectedReturnPct: 6.005 });
    expect(created).toEqual({
      id: classIdOf('Real Estate'), name: 'Real Estate', color: '#aabbcc', liquid: false, expectedReturnPct: 6.01,
      isDefault: false, holdingsCount: 0, valueUsd: 0,
    });
    expect(await all(api)).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto', 'Real Estate']);

    for (const name of ['Real Estate', 'Cash']) {
      await expect(api.createAssetClass({ name })).rejects.toMatchObject({
        status: 409, code: 'class-exists', message: `There's already a class named "${name}"`,
      });
    }
    await expect(api.createAssetClass({ name: ' ', color: 'blue', expectedReturnPct: 101 })).rejects.toMatchObject({
      status: 400,
      message: 'Name is required; color must be a hex color like #1a2b3c; expectedReturnPct must be between -100 and 100',
    });
    await expect(api.createAssetClass({ name: 'x'.repeat(61) })).rejects.toMatchObject({ message: 'Name must be at most 60 characters' });
  });

  it('caps the classes a user sets up', async () => {
    const api = demo();
    for (let i = 0; i < 100; i++) await api.createAssetClass({ name: `Class ${i}` });
    await expect(api.createAssetClass({ name: 'One more' })).rejects.toMatchObject({
      status: 409, code: 'limit-exceeded', message: 'You can set up to 100 asset classes. Remove one to add another.',
    });
    // Changing a default one needs a place too; clearing it frees one.
    await expect(api.updateAssetClass(classIdOf('Cash'), { color: '#000000' })).rejects.toMatchObject({ status: 409 });
    await api.deleteAssetClass(classIdOf('Class 0'));
    await api.updateAssetClass(classIdOf('Cash'), { color: '#000000' });
  });

  it('sets a class up, and its liquidity and return count in the summary and the holdings', async () => {
    const api = demo();
    // Fixed Income becomes ready to spend; Crypto stops; Crypto's holdings count at 10% unless they have their own.
    await api.updateAssetClass(classIdOf('Fixed Income'), { liquid: true, color: '#123456' });
    const crypto = await api.updateAssetClass(classIdOf('Crypto'), { liquid: false, expectedReturnPct: 10 });
    expect(crypto).toMatchObject({ liquid: false, expectedReturnPct: 10, holdingsCount: 2, valueUsd: 24_570 });

    const summary = await api.getSummary();
    expect(summary.liquidity.liquidAssetClasses).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity']);
    expect(summary.byAssetClass.find((c) => c.assetClass === 'Fixed Income')).toMatchObject({ color: '#123456', liquid: true });
    // Bitcoin and Ethereum have 20% of their own: the class's doesn't change them.
    const [btc] = (await api.getHoldings()).filter((h) => h.name === 'Bitcoin');
    expect(btc.effectiveReturnPct).toBe(20);
    await api.updateHolding(btc.id, { expectedReturnPct: null });
    const after = (await api.getHoldings()).find((h) => h.id === btc.id)!;
    expect(after).toMatchObject({ expectedReturnPct: null, effectiveReturnPct: 10 });
    const estimate = await api.getEstimate({ contribution: 0, years: 1 });
    expect(estimate.portfolioYieldPct).toBe((await api.getSummary()).expectedReturn.weightedPct);

    // Null clears; a default class back to its defaults is as if never touched.
    const cleared = await api.updateAssetClass(classIdOf('Crypto'), { liquid: null, expectedReturnPct: null });
    expect(cleared).toMatchObject({ liquid: true, expectedReturnPct: null });
  });

  it('renames a class on all its holdings, or merges it once asked', async () => {
    const api = demo();
    const renamed = await api.updateAssetClass(classIdOf('Crypto'), { name: 'Coins', color: '#ff0000' });
    expect(renamed).toMatchObject({ name: 'Coins', color: '#ff0000', holdingsCount: 2, isDefault: false });
    expect(await holdingsOf(api, 'Coins')).toEqual(['Bitcoin', 'Ethereum']);
    // A renamed default stays gone.
    expect(await all(api)).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Coins']);

    await expect(api.updateAssetClass(classIdOf('Coins'), { name: 'Equity' })).rejects.toMatchObject({ status: 409, code: 'class-exists' });
    const merged = await api.updateAssetClass(classIdOf('Coins'), { name: 'Equity', mergeIfExists: true, color: '#00ff00' });
    expect(merged).toMatchObject({ name: 'Equity', color: null, holdingsCount: 3 });
    expect(await all(api)).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity']);

    // Creating a removed default brings it back.
    expect(await api.createAssetClass({ name: 'Crypto' })).toMatchObject({ isDefault: true, liquid: true });
    expect(await all(api)).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto']);
  });

  it('removes a class, moving its holdings', async () => {
    const api = demo();
    await expect(api.deleteAssetClass(classIdOf('Crypto'))).rejects.toMatchObject({
      status: 409, code: 'class-in-use', message: 'Crypto still has assets: say which class they move to (moveTo)',
    });
    await expect(api.deleteAssetClass(classIdOf('Crypto'), 'Crypto')).rejects.toMatchObject({ status: 400, message: 'moveTo must be another class' });
    await expect(api.deleteAssetClass(classIdOf('Crypto'), ' ')).rejects.toMatchObject({ status: 400, message: 'AssetClass must not be blank' });
    await expect(api.deleteAssetClass(classIdOf('Crypto'), 'x'.repeat(61))).rejects.toMatchObject({ status: 400 });
    await api.deleteAssetClass(classIdOf('Crypto'), 'Equity');
    expect(await holdingsOf(api, 'Equity')).toEqual(['Apple (AAPL)', 'Bitcoin', 'Ethereum']);
    expect(await all(api)).not.toContain('Crypto');

    // Not one of the user's (anymore): not found.
    for (const id of [classIdOf('Crypto'), classIdOf('Gold'), '%%%', 'IENhc2gg']) {
      await expect(api.deleteAssetClass(id)).rejects.toMatchObject({ status: 404, message: 'Asset class not found' });
    }
    await expect(api.updateAssetClass(classIdOf('Gold'), { color: '#000000' })).rejects.toMatchObject({ status: 404 });

    // A class created without assets just goes.
    await api.createAssetClass({ name: 'Art' });
    await api.deleteAssetClass(classIdOf('Art'));
    expect(await all(api)).not.toContain('Art');
  });
});

describe('mock API: platforms', () => {
  const find = async (api: ReturnType<typeof demo>, name: string) => (await api.getPlatforms()).find((p) => p.name === name);

  it('customizes a platform, and resets it', async () => {
    const api = demo();
    const id = platformIdOf('Binance');
    const p = await api.updatePlatform(id, { avatarText: ' 🟡 ', color: '#F0B90B', type: ' Crypto exchange ' });
    expect(p).toMatchObject({ name: 'Binance', avatarText: '🟡', color: '#f0b90b', type: 'Crypto exchange', holdingsCount: 2 });
    expect((await api.getSummary()).byPlatform.find((b) => b.name === 'Binance')).toMatchObject({
      avatarText: '🟡', color: '#f0b90b', type: 'Crypto exchange',
    });
    const reset = await api.updatePlatform(id, { avatarText: null, color: null, type: null });
    expect(reset).toMatchObject({ avatarText: null, color: null, type: 'Exchange' }); // the type it had before
    expect((await api.updatePlatform(id, { type: '  ' })).type).toBe('Exchange');
  });

  it('checks what is sent', async () => {
    const api = demo();
    await expect(
      api.updatePlatform(platformIdOf('Binance'), { name: ' ', type: 'x'.repeat(41), avatarText: 'ABC', color: 'red' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Name is required; type must be at most 40 characters; avatarText must be 1 or 2 characters (an emoji counts as one); color must be a hex color like #1a2b3c',
    });
    await expect(api.updatePlatform(platformIdOf('Binance'), { name: 'x'.repeat(121) })).rejects.toMatchObject({ message: 'Name must be at most 120 characters' });
    await expect(api.updatePlatform(platformIdOf('Nowhere'), { color: '#000000' })).rejects.toMatchObject({ status: 404, message: 'Platform not found' });
  });

  it('renames a platform on all its holdings, takes its look along, or merges it once asked', async () => {
    const api = demo();
    await api.updatePlatform(platformIdOf('Binance'), { avatarText: 'BN' });
    const respelled = await api.updatePlatform(platformIdOf('Binance'), { name: 'BINANCE' });
    expect(respelled).toMatchObject({ name: 'BINANCE', avatarText: 'BN' });
    const renamed = await api.updatePlatform(platformIdOf('Binance'), { name: 'Binance Global' });
    expect(renamed).toMatchObject({ name: 'Binance Global', avatarText: 'BN', holdingsCount: 2 });
    expect((await api.getHoldings()).filter((h) => h.platform === 'Binance Global')).toHaveLength(2);

    await api.updatePlatform(platformIdOf('Santander'), { color: '#ff0000' });
    await expect(api.updatePlatform(platformIdOf('Mercado Pago'), { name: 'santander' })).rejects.toMatchObject({
      status: 409, code: 'platform-exists', message: 'There\'s already a platform named "Santander"',
    });
    const merged = await api.updatePlatform(platformIdOf('Mercado Pago'), { name: 'santander', mergeIfExists: true, avatarText: 'X' });
    expect(merged).toMatchObject({ name: 'Santander', holdingsCount: 2, color: '#ff0000', avatarText: null });
    expect(await find(api, 'Mercado Pago')).toBeUndefined();
  });

  it('keeps a look when the platform is emptied and used again', async () => {
    const api = demo();
    await api.updatePlatform(platformIdOf('Mercado Pago'), { avatarText: 'MP' });
    const [fund] = (await api.getHoldings()).filter((h) => h.platform === 'Mercado Pago');
    await api.deleteHolding(fund.id);
    expect(await find(api, 'Mercado Pago')).toBeUndefined();
    await api.createHolding({ name: 'Wallet', assetClass: 'Cash', platform: 'mercado pago', valueUsd: 10 });
    expect(await find(api, 'mercado pago')).toMatchObject({ avatarText: 'MP' });
  });

  it('caps the platforms a user customizes', () => {
    const holding = (name: string, platform: string): Holding => ({
      id: name, name, assetClass: 'Cash', platform, valueUsd: 1, expectedReturnPct: null, effectiveReturnPct: null,
      createdAt: '', updatedAt: '',
    });
    const custom = createMockCustomization({
      holdings: [holding('a', 'A'), holding('b', 'B')],
      defaultClasses: [],
      liquidClasses: [],
      legacyType: () => null,
      limits: { classes: 1, platforms: 1 },
    });
    custom.updatePlatform(platformIdOf('A'), { color: '#000000' });
    expect(() => custom.updatePlatform(platformIdOf('B'), { color: '#000000' })).toThrow(
      'You can customize up to 1 platforms. Reset one to customize another.',
    );
    // Resetting one frees its place.
    custom.updatePlatform(platformIdOf('A'), { color: null });
    expect(custom.updatePlatform(platformIdOf('B'), { color: '#000000' }).color).toBe('#000000');
  });
});
