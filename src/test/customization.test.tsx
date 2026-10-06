import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ASSET_CLASSES,
  assetClass,
  HOLDINGS,
  holding,
  installFakeBackend,
  json,
  nav,
  platform,
  PLATFORMS,
  renderApp,
  requests,
  routes,
  summary,
} from './harness';
import { listNames } from '@/components/views/DashboardView';

// F5: setting up classes and platforms. The Settings view, creating, editing, merging and removing classes,
// customizing, renaming and merging platforms, and how the user's colors and thumbnails show everywhere. The
// backend is faked (harness.ts); the app runs for real.

installFakeBackend();

const sent = (method: string, path: string, i = 0) => JSON.parse(requests(method, path)[i][1].body);
const dialog = (name: string) => screen.getByRole('dialog', { name });
const type = (label: string, value: string, within_: HTMLElement = document.body) =>
  fireEvent.change(within(within_).getByLabelText(label), { target: { value } });
const click = (name: string | RegExp, within_: HTMLElement = document.body) => fireEvent.click(within(within_).getByRole('button', { name }));
const section = (name: string) => screen.getByRole('region', { name });
const row = (table: HTMLElement, name: string) => within(table).getAllByRole('row').find((r) => r.textContent?.includes(name))!;

async function openSettings() {
  await renderApp();
  nav('Settings');
  await screen.findByRole('heading', { name: 'Asset classes' });
}

describe('Settings', () => {
  it('lists the classes and platforms, each as the user set it up', async () => {
    routes['GET /api/v1/asset-classes'] = () =>
      json({
        ...ASSET_CLASSES,
        classes: [
          assetClass('Cash', { isDefault: true, liquid: true }),
          assetClass('Equity', { liquid: true, expectedReturnPct: 8.5, holdingsCount: 1, valueUsd: 8000, color: '#ff0000' }),
          assetClass('Gold', { holdingsCount: 2, valueUsd: 4345.6 }),
        ],
      });
    routes['GET /api/v1/platforms'] = () =>
      json([platform('Balanz', { type: 'Broker', avatarText: 'BZ', color: '#00ff00', holdingsCount: 1, valueUsd: 8000 }), platform('Vault')]);
    await openSettings();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();

    const classes = section('Asset classes');
    expect(row(classes, 'Cash').textContent).toContain('Default');
    const equity = row(classes, 'Equity');
    expect(equity.textContent).toContain('Ready to spend');
    expect(equity.textContent).toContain('8.5% a year');
    expect(equity.textContent).toContain('$8,000');
    expect((equity.querySelector('.class-dot') as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    expect(row(classes, 'Gold').textContent).toContain('Locked in');

    const platforms = section('Platforms');
    const balanz = row(platforms, 'Balanz');
    expect(balanz.querySelector('.platform-avatar')!.textContent).toBe('BZ');
    expect(balanz.textContent).toContain('Broker');
    expect(row(platforms, 'Vault').querySelector('.platform-avatar')!.textContent).toBe('V');
  });

  it('creates a class', async () => {
    routes['POST /api/v1/asset-classes'] = (init) => json({ ...assetClass('Real Estate'), ...JSON.parse(String(init.body)) }, 201);
    await openSettings();
    click('New class');
    const form = dialog('New class');
    type('Name', '  Real Estate ', form);
    fireEvent.click(within(form).getByRole('radio', { name: 'Violet' }));
    type('Default return (% a year, optional)', '6,5', form);
    click('Add class', form);

    expect(await screen.findByText('Real Estate added')).toBeTruthy();
    expect(sent('POST', '/api/v1/asset-classes')).toEqual({ name: 'Real Estate', color: '#9b79ee', liquid: false, expectedReturnPct: 6.5 });
    expect(screen.queryByRole('dialog', { name: 'New class' })).toBeNull();
  });

  it("won't create a class the user has, nor one without a name", async () => {
    await openSettings();
    click('New class');
    const form = dialog('New class');
    click('Add class', form);
    expect(within(form).getByText('Please enter a name')).toBeTruthy();
    type('Name', 'Gold', form);
    click('Add class', form);
    expect(within(form).getByText('You already have a class named Gold')).toBeTruthy();
    expect(requests('POST', '/api/v1/asset-classes')).toHaveLength(0);
  });

  it('edits a class: only what changed is sent', async () => {
    routes['PATCH /api/v1/asset-classes/id-Gold'] = () => json(assetClass('Gold', { liquid: true }));
    await openSettings();
    click('Edit Gold');
    const form = dialog('Edit Gold');
    expect((within(form).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(form).getByLabelText('Ready to spend'));
    fireEvent.change(within(form).getByLabelText('Or your own'), { target: { value: '1A2B3C' } });
    click('Save changes', form);

    expect(await screen.findByText('Changes saved')).toBeTruthy();
    expect(sent('PATCH', '/api/v1/asset-classes/id-Gold')).toEqual({ liquid: true, color: '#1a2b3c' });
  });

  it('renames a class onto another as a merge, once confirmed', async () => {
    routes['PATCH /api/v1/asset-classes/id-Gold'] = () => json(assetClass('Equity', { holdingsCount: 3 }));
    await openSettings();
    click('Edit Gold');
    const form = dialog('Edit Gold');
    type('Name', 'Equity', form);
    expect(within(form).getByText('Equity already exists: saving merges Gold into it.')).toBeTruthy();
    click('Merge…', form);

    const confirm = dialog('Merge into Equity?');
    expect(confirm.textContent).toContain('Merge Gold into Equity? Its 2 assets move to Equity. Equity keeps its own color and settings.');
    expect(within(form).getByText('Color').textContent).toBe('Color · Default');
    click('Merge', confirm);
    expect(await screen.findByText('Merged into Equity')).toBeTruthy();
    expect(sent('PATCH', '/api/v1/asset-classes/id-Gold')).toEqual({ name: 'Equity', mergeIfExists: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('removes a class with assets, moving them to another', async () => {
    routes['DELETE /api/v1/asset-classes/id-Gold'] = () => new Response(null, { status: 204 });
    await openSettings();
    click('Remove Gold');
    const confirm = dialog('Remove Gold?');
    expect(confirm.textContent).toContain('Its 2 assets move to another class, all at once.');
    fireEvent.change(within(confirm).getByLabelText('Move its 2 assets to'), { target: { value: 'Equity' } });
    click('Move and remove', confirm);

    expect(await screen.findByText('Gold removed · its assets are in Equity')).toBeTruthy();
    const [[url]] = requests('DELETE', '/api/v1/asset-classes/id-Gold');
    expect(new URL(url).searchParams.get('moveTo')).toBe('Equity');
  });

  it('removes a default class without assets, saying it will not come back', async () => {
    routes['DELETE /api/v1/asset-classes/id-Cash'] = () => new Response(null, { status: 204 });
    await openSettings();
    click('Remove Cash');
    const confirm = dialog('Remove Cash?');
    expect(confirm.textContent).toContain('It has no assets. It won’t come back unless you add it again.');
    click('Remove', confirm);
    expect(await screen.findByText('Cash removed')).toBeTruthy();
    const [[url]] = requests('DELETE', '/api/v1/asset-classes/id-Cash');
    expect(new URL(url).search).toBe('');
  });

  it('shows what the API says when a change fails, and reloads what is out of date', async () => {
    routes['DELETE /api/v1/asset-classes/id-Gold'] = () =>
      json({ type: 'https://base.wealth/errors/class-in-use', detail: 'Gold still has assets: say which class they move to (moveTo)' }, 409);
    await openSettings();
    const before = requests('GET', '/api/v1/asset-classes').length;
    click('Remove Gold');
    click('Move and remove', dialog('Remove Gold?'));
    expect(await within(dialog('Remove Gold?')).findByText('Gold still has assets: say which class they move to (moveTo)')).toBeTruthy();
    await waitFor(() => expect(requests('GET', '/api/v1/asset-classes').length).toBeGreaterThan(before));
  });

  it('customizes a platform with a live preview, and resets it', async () => {
    let balanz = PLATFORMS[0];
    routes['GET /api/v1/platforms'] = () => json([balanz, ...PLATFORMS.slice(1)]);
    routes['PATCH /api/v1/platforms/id-Balanz'] = (init) => {
      balanz = { ...balanz, ...JSON.parse(String(init.body)) };
      return json(balanz);
    };
    await openSettings();
    click('Customize Balanz');
    const form = dialog('Customize Balanz');
    const preview = () => form.querySelector('.platform-preview .platform-avatar')!.textContent;
    expect(preview()).toBe('B');

    type('Thumbnail', 'ABC', form);
    expect(within(form).getByText('1 or 2 characters, or one emoji')).toBeTruthy();
    expect(preview()).toBe('B');
    type('Thumbnail', ' 🏦 ', form);
    expect(preview()).toBe('🏦');
    fireEvent.click(within(form).getByRole('radio', { name: 'Amber' }));
    type('Type', 'Broker', form);
    click('Save changes', form);

    expect(await screen.findByText('Changes saved')).toBeTruthy();
    expect(sent('PATCH', '/api/v1/platforms/id-Balanz')).toEqual({ type: 'Broker', avatarText: '🏦', color: '#e7b643' });
    await waitFor(() => expect(row(section('Platforms'), 'Balanz').querySelector('.platform-avatar')!.textContent).toBe('🏦'));

    // Reset to default: its initial and a color from its name again.
    click('Customize Balanz');
    const again = dialog('Customize Balanz');
    expect(again.querySelector('.platform-preview .platform-avatar')!.textContent).toBe('🏦');
    click('Reset to default', again);
    expect(again.querySelector('.platform-preview .platform-avatar')!.textContent).toBe('B');
    click('Save changes', again);
    await waitFor(() => expect(requests('PATCH', '/api/v1/platforms/id-Balanz')).toHaveLength(2));
    expect(sent('PATCH', '/api/v1/platforms/id-Balanz', 1)).toEqual({ avatarText: null, color: null });
  });

  it('renames a platform onto another (case aside) as a merge, once confirmed', async () => {
    routes['PATCH /api/v1/platforms/id-Balanz'] = () => json(platform('Vault', { holdingsCount: 3 }));
    await openSettings();
    click('Customize Balanz');
    const form = dialog('Customize Balanz');
    type('Name', 'vault', form);
    expect(within(form).getByText('Vault already exists: saving merges Balanz into it.')).toBeTruthy();
    click('Merge…', form);
    const confirm = dialog('Merge into Vault?');
    expect(confirm.textContent).toContain('Merge Balanz into Vault? Its asset moves there, and Vault keeps its own look.');
    click('Merge', confirm);
    expect(await screen.findByText('Merged into Vault')).toBeTruthy();
    expect(sent('PATCH', '/api/v1/platforms/id-Balanz')).toEqual({ name: 'Vault', mergeIfExists: true });
  });
});

describe("the user's colors and thumbnails", () => {
  const custom = () => {
    routes['GET /api/v1/wealth/summary'] = () =>
      json(
        summary({
          byAssetClass: [
            { assetClass: 'Equity', valueUsd: 8000, pct: 64.8, count: 1, color: '#ff0000', liquid: true },
            { assetClass: 'Gold', valueUsd: 4345.6, pct: 35.2, count: 2, color: null, liquid: false },
          ],
          byPlatform: [
            { name: 'Balanz', type: 'Broker', valueUsd: 8000, pct: 64.8, count: 1, avatarText: 'BZ', color: '#00ff00' },
            { name: 'Vault', type: 'Safe', valueUsd: 4345.6, pct: 35.2, count: 2, avatarText: null, color: null },
          ],
        }),
      );
    routes['GET /api/v1/platforms'] = () => json([platform('Balanz', { avatarText: 'BZ', color: '#00ff00' }), ...PLATFORMS.slice(1)]);
    routes['GET /api/v1/asset-classes'] = () =>
      json({ ...ASSET_CLASSES, classes: [assetClass('Cash'), assetClass('Equity', { color: '#ff0000' }), assetClass('Gold')] });
  };

  it('show on the dashboard, Platforms and Assets', async () => {
    custom();
    await renderApp();
    // Dashboard: where it lives, and the donut's legend.
    const lives = screen.getByText('Where it lives').parentElement!;
    expect([...lives.querySelectorAll('.platform-avatar')].map((a) => a.textContent)).toEqual(['BZ', 'V']);
    expect((lives.querySelector('.platform-avatar') as HTMLElement).style.color).toBe('rgb(0, 255, 0)');

    nav('Platforms');
    expect(screen.getByText('BZ')).toBeTruthy();
    click('Customize Balanz');
    expect(dialog('Customize Balanz')).toBeTruthy();
    click('Cancel', dialog('Customize Balanz'));

    nav('Assets');
    const spy = screen.getByRole('row', { name: /SPY/ });
    expect(spy.querySelector('.platform-avatar')!.textContent).toBe('BZ');
    const tag = within(spy).getByText('Equity');
    expect(tag.className).toBe('tag tag-custom');
    expect(tag.style.getPropertyValue('--tag-color')).toBe('#ff0000');
    // The class chips show each class's color.
    const chip = screen.getByRole('button', { name: 'Equity', pressed: false });
    expect((chip.querySelector('.class-dot') as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    // The platform filter shows the picked one's thumbnail.
    const filter = screen.getByLabelText('Filter by platform');
    expect(filter.parentElement!.querySelector('.platform-avatar')).toBeNull();
    fireEvent.change(filter, { target: { value: 'Balanz' } });
    expect(filter.parentElement!.querySelector('.platform-avatar')!.textContent).toBe('BZ');
  });

  it('show in the transfer dialog', async () => {
    custom();
    await renderApp();
    nav('Platforms');
    click('Transfer from Balanz');
    const transfer = dialog('Transfer');
    const from = within(transfer).getAllByLabelText('Platform')[0];
    expect(from.parentElement!.querySelector('.platform-avatar')!.textContent).toBe('BZ');
    const to = within(transfer).getAllByLabelText('Platform')[1];
    expect(to.parentElement!.querySelector('.platform-avatar')).toBeNull();
    fireEvent.change(to, { target: { value: 'Vault' } });
    expect(to.parentElement!.querySelector('.platform-avatar')!.textContent).toBe('V');
  });

  it("say where an asset's return comes from", async () => {
    routes['GET /api/v1/holdings'] = () =>
      json([{ ...holding('h2', 'Gold bar', 'Gold', 'Vault', 4000), effectiveReturnPct: 3 }, ...HOLDINGS.filter((h) => h.id !== 'h2')]);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Gold bar' }));
    expect(await screen.findByText('· from Gold')).toBeTruthy();
    expect(screen.getByText(/Expected to grow 3% a year/)).toBeTruthy();
  });

  it("count what the user set as ready to spend, with a way there", async () => {
    custom();
    await renderApp();
    const card = screen.getByText('Ready to spend').parentElement!;
    expect(card.querySelector('.card-body')!.textContent).toBe('Equity you can move quickly · 30% locked in · Change');
    click('Change', card);
    expect(await screen.findByRole('heading', { name: 'Asset classes' })).toBeTruthy();
  });
});

describe('listNames', () => {
  it('lists up to four names, then says how many more', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Cash'])).toBe('Cash');
    expect(listNames(['Cash', 'Crypto'])).toBe('Cash and Crypto');
    expect(listNames(['Cash', 'Equity', 'Crypto', 'Gold'])).toBe('Cash, Equity, Crypto and Gold');
    expect(listNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more');
  });
});
