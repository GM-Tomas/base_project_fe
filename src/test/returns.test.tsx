import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLDINGS, holding, installFakeBackend, json, nav, point, projection, renderApp, requests, routes, summary } from './harness';
import { DEFAULT_PREFERENCES } from '@/lib/preferences';

// F4: each asset's expected yearly return (its field, column and panel line, and setting them all at once),
// the portfolio's on the dashboard, and Estimate growing at it, with its saved settings. The backend is faked
// (harness.ts); the app runs for real.

installFakeBackend();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T15:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

const sent = (method: string, path: string, i = 0) => JSON.parse(requests(method, path)[i][1].body);
const dialog = (name: string) => screen.getByRole('dialog', { name });
const fill = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
const estimateQuery = (i = -1) => new URL(requests('GET', '/api/v1/wealth/estimate').at(i)![0]).searchParams;

describe('the portfolio’s expected return on the dashboard', () => {
  it('shows it, what it’s worth a year, and how much of the portfolio it’s based on', async () => {
    await renderApp();

    const card = screen.getByText('Expected return').closest('.card') as HTMLElement;
    expect(within(card).getByText('5.2% / yr')).toBeTruthy();
    expect(card.textContent).toContain('≈ $640 a year · Based on 64.8% of your portfolio.');
    fireEvent.click(within(card).getByRole('button', { name: 'Set returns' }));
    expect(dialog('Set expected returns')).toBeTruthy();
  });

  it('asks for the returns when none is set, and waits for assets', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ expectedReturn: { weightedPct: 0, coveragePct: 0, annualUsd: 0 } }));
    await renderApp();
    const card = screen.getByText('Expected return').closest('.card') as HTMLElement;
    expect(within(card).getByText('0% / yr')).toBeTruthy();
    expect(card.textContent).toContain('Say roughly what each asset earns to see it.');
  });

  it('says so when every asset has one', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ expectedReturn: { weightedPct: 7, coveragePct: 100, annualUsd: 864.19 } }));
    await renderApp();
    const card = screen.getByText('Expected return').closest('.card') as HTMLElement;
    expect(card.textContent).toContain('≈ $864 a year');
    expect(within(card).queryByRole('button')).toBeNull();
  });
});

describe('an asset’s expected return', () => {
  it('is asked for when adding one, typed either way', async () => {
    routes['POST /api/v1/holdings'] = () => json(holding('h9', 'Bond', 'Fixed Income', 'Balanz', 100, 4.5), 201);
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add an asset' }));
    const d = dialog('Add an asset');

    fill(d, 'Name', 'Bond');
    fireEvent.change(within(d).getAllByRole('combobox')[0], { target: { value: 'Balanz' } });
    fireEvent.change(within(d).getAllByRole('combobox')[1], { target: { value: 'Fixed Income' } });
    fill(d, 'Value (USD)', '100');
    expect(within(d).getByText("Roughly how much it grows in a year. Leave empty if you don't know (counts as 0%).")).toBeTruthy();
    fill(d, 'Expected yearly return (optional)', '450');
    expect(within(d).getByText('Between -100% and 100%')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save asset' }));
    expect(within(d).getByText('Expected return: Between -100% and 100%')).toBeTruthy();
    fill(d, 'Expected yearly return (optional)', '4,5');
    expect(within(d).getByText('= 4.5% a year')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save asset' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('POST', '/api/v1/holdings')).toEqual({
      name: 'Bond',
      assetClass: 'Fixed Income',
      platform: 'Balanz',
      valueUsd: 100,
      expectedReturnPct: 4.5,
    });
  });

  it('is changed or cleared when editing one, and alone is a change', async () => {
    routes['PATCH /api/v1/holdings/h1'] = () => json(holding('h1', 'SPY', 'Equity', 'Balanz', 8000));
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Edit SPY' }));
    const d = dialog('Edit asset');

    const save = within(d).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect((within(d).getByLabelText('Expected yearly return (optional)') as HTMLInputElement).value).toBe('8');
    expect(save.disabled).toBe(true);
    fill(d, 'Expected yearly return (optional)', '');
    expect(save.disabled).toBe(false);
    // Only the return: no reason to ask for.
    expect(within(d).queryByRole('radio')).toBeNull();
    fireEvent.click(save);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('PATCH', '/api/v1/holdings/h1')).toEqual({ expectedReturnPct: null });
  });

  it('has its column in Assets, sorted with those without one last', async () => {
    await renderApp();
    nav('Assets');

    const header = screen.getByRole('button', { name: 'Return/yr' });
    const rows = () => screen.getAllByRole('row').slice(1, -1);
    expect(within(rows()[0]).getByText('8%')).toBeTruthy();
    expect(within(rows()[1]).getByText('—')).toBeTruthy();
    fireEvent.click(header);
    expect(header.closest('th')!.getAttribute('aria-sort')).toBe('descending');
    expect(rows().map((r) => within(r).getAllByRole('button')[0].textContent)).toEqual(['SPY', 'Coins', 'Gold bar']);
    fireEvent.click(header);
    expect(rows()[0].textContent).toContain('SPY');
  });

  it('is in its panel, with a way to set one', async () => {
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'SPY' }));
    expect(within(dialog('SPY')).getByText('Expected to grow 8% a year')).toBeTruthy();
    fireEvent.click(within(dialog('SPY')).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Gold bar' }));
    const panel = dialog('Gold bar');
    expect(panel.textContent).toContain('No expected return yet (counts as 0%).');
    fireEvent.click(within(panel).getByRole('button', { name: 'Set one' }));
    expect(dialog('Edit asset')).toBeTruthy();
  });

  it('reads as a loss when it’s below zero', async () => {
    routes['GET /api/v1/holdings'] = () => json([holding('h1', 'SPY', 'Equity', 'Balanz', 8000, -2.5)]);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'SPY' }));
    expect(within(dialog('SPY')).getByText('Expected to lose 2.5% a year')).toBeTruthy();
  });
});

describe('setting every expected return at once', () => {
  it('groups the assets by class, applies one to a class, and saves what changed', async () => {
    routes['PUT /api/v1/holdings/expected-returns'] = () => json([]);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Set expected returns' }));
    const d = dialog('Set expected returns');

    // Largest class first: Equity (8,000), then Gold (4,345.60).
    expect([...d.querySelectorAll('legend')].map((l) => l.textContent)).toEqual(['Equity', 'Gold']);
    expect((within(d).getByLabelText('Expected return of SPY') as HTMLInputElement).value).toBe('8');
    expect(d.textContent).toContain('Your portfolio: 5.2% a year · ≈ $640');
    expect(d.textContent).toContain('Based on 64.8% of your portfolio');

    const apply = within(d).getByRole('button', { name: 'Apply to Gold' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fill(d, 'Return for all of Gold', '3');
    fireEvent.click(apply);
    expect((within(d).getByLabelText('Expected return of Coins') as HTMLInputElement).value).toBe('3');
    expect((within(d).getByLabelText('Expected return of Gold bar') as HTMLInputElement).value).toBe('3');
    // (8,000 × 8 + 4,345.60 × 3) / 12,345.60
    expect(d.textContent).toContain('Your portfolio: 6.2% a year · ≈ $770');
    expect(d.textContent).toContain('Every asset has a return');

    fill(d, 'Expected return of Coins', 'lots');
    fireEvent.click(within(d).getByRole('button', { name: 'Save 1 return' }));
    expect(within(d).getByText('Check the return of Coins')).toBeTruthy();
    fill(d, 'Expected return of Coins', '3');
    fireEvent.click(within(d).getByRole('button', { name: 'Save 2 returns' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent('PUT', '/api/v1/holdings/expected-returns')).toEqual({
      items: [
        { holdingId: 'h2', expectedReturnPct: 3 },
        { holdingId: 'h3', expectedReturnPct: 3 },
      ],
    });
    expect(screen.getByText('Expected returns saved')).toBeTruthy();
  });

  it('closes without asking when nothing changed, and says what the API refused', async () => {
    routes['PUT /api/v1/holdings/expected-returns'] = () => json({ status: 404, detail: 'Holding h2 not found' }, 404);
    await renderApp();
    nav('Assets');
    fireEvent.click(screen.getByRole('button', { name: 'Set expected returns' }));
    fireEvent.click(within(dialog('Set expected returns')).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requests('PUT', '/api/v1/holdings/expected-returns')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Set expected returns' }));
    const d = dialog('Set expected returns');
    fill(d, 'Expected return of Gold bar', '2');
    fill(d, 'Expected return of SPY', '');
    fireEvent.click(within(d).getByRole('button', { name: 'Save 2 returns' }));
    expect(await within(d).findByText('Holding h2 not found')).toBeTruthy();
    // Out of date: reloaded.
    await waitFor(() => expect(requests('GET', '/api/v1/holdings').length).toBeGreaterThan(1));
  });

  it('has nothing to weigh without assets', async () => {
    routes['GET /api/v1/holdings'] = () => json([]);
    await renderApp();
    nav('Estimate');
    expect(screen.getByText('With no assets yet, this starts from $0.')).toBeTruthy();
    expect(screen.queryByText('What your expected return is made of')).toBeNull();
  });
});

describe('Estimate', () => {
  it('grows at the portfolio’s expected return, with the saved settings', async () => {
    await renderApp();
    nav('Estimate');

    expect(await screen.findByText('$25,000')).toBeTruthy();
    expect(estimateQuery(0).toString()).toBe('contribution=900&years=12&milestones=150000%2C250000');
    expect((screen.getByRole('radio', { name: 'Your portfolio' }) as HTMLInputElement).checked).toBe(true);
    const growth = screen.getByText('Yearly growth').closest('.field') as HTMLElement;
    expect(within(growth).getByText('5.2%')).toBeTruthy();
    expect(growth.textContent).toContain('Your portfolio: 5.2% (weighted by value). Based on 64.8% of it.');
    expect(screen.getByText('$50k')).toBeTruthy();
    expect(screen.getByText('Mar 2029')).toBeTruthy();
    expect(screen.getByText('$123,456')).toBeTruthy();
    expect(screen.getByText('not within 12y at this pace')).toBeTruthy();
    expect(screen.getByText('at this pace')).toBeTruthy();
  });

  it('starts from what was saved, on any device', async () => {
    routes['GET /api/v1/preferences'] = () =>
      json({ estimate: { ...DEFAULT_PREFERENCES.estimate, years: 20, yieldMode: 'CUSTOM', customYieldPct: 6, milestonesUsd: [] } });
    await renderApp();
    nav('Estimate');

    await screen.findByText('$25,000');
    expect(estimateQuery(0).toString()).toBe('contribution=900&years=20&yieldPct=6&milestones=');
    expect(screen.getByText('20 years')).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Custom' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('starts from the defaults when the saved settings can’t be read', async () => {
    routes['GET /api/v1/preferences'] = () => json({ detail: 'boom' }, 500);
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');
    expect(screen.getByText('12 years')).toBeTruthy();
  });

  it('switches to a growth of one’s own with the slider, and back', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');

    const [yieldSlider, contribution, years] = screen.getAllByRole('slider');
    fireEvent.change(yieldSlider, { target: { value: '-2.5' } });
    expect((screen.getByRole('radio', { name: 'Custom' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('-2.5%')).toBeTruthy();
    fireEvent.change(contribution, { target: { value: '1000' } });
    fireEvent.change(years, { target: { value: '1' } });
    expect(screen.getByText('$1,000')).toBeTruthy();
    expect(screen.getByText('1 year')).toBeTruthy();
    await waitFor(() => expect(estimateQuery().toString()).toBe('contribution=1000&years=1&yieldPct=-2.5&milestones=150000%2C250000'));

    fireEvent.click(screen.getByRole('button', { name: 'Use my portfolio (5.2%)' }));
    expect((screen.getByRole('radio', { name: 'Your portfolio' }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(estimateQuery().has('yieldPct')).toBe(false));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    await waitFor(() => expect(estimateQuery().get('yieldPct')).toBe('-2.5'));
  });

  it('takes a typed monthly saving beyond the slider', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');

    fireEvent.change(screen.getByLabelText('Or type the amount'), { target: { value: '12.500' } });
    expect(screen.getByText('$12,500')).toBeTruthy();
    expect((screen.getAllByRole('slider')[1] as HTMLInputElement).value).toBe('10000');
    await waitFor(() => expect(estimateQuery().get('contribution')).toBe('12500'));
    fireEvent.change(screen.getByLabelText('Or type the amount'), { target: { value: '2,000,000,000' } });
    expect(screen.getByText('Up to $1,000,000,000 a month')).toBeTruthy();
    expect(screen.getByText('$12,500')).toBeTruthy();
    // The slider takes over the typed amount.
    fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '300' } });
    expect((screen.getByLabelText('Or type the amount') as HTMLInputElement).value).toBe('300');
  });

  it('saves the settings a second after the last change, and says so when it can’t', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');

    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '30' } });
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '31' } });
    await waitFor(() => expect(requests('PUT', '/api/v1/preferences')).toHaveLength(1), { timeout: 3000 });
    expect(sent('PUT', '/api/v1/preferences')).toEqual({ estimate: { ...DEFAULT_PREFERENCES.estimate, years: 31 } });

    routes['PUT /api/v1/preferences'] = () => Promise.reject(new TypeError('offline'));
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '32' } });
    expect(
      await screen.findByText("Couldn't save your Estimate settings. They'll be saved with your next change.", {}, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it('edits the milestones', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');
    const tags = () => [...document.querySelectorAll('.chips .tag')].map((t) => t.textContent);
    expect(tags()).toEqual(['$150k', '$250k']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit milestones' }));
    let d = dialog('Edit milestones');
    fireEvent.click(within(d).getByRole('button', { name: 'Add a milestone' }));
    fill(d, 'Milestone 3', '1,500,000');
    fireEvent.click(within(d).getByRole('button', { name: 'Add a milestone' }));
    fill(d, 'Milestone 4', '0');
    fireEvent.click(within(d).getByRole('button', { name: 'Save milestones' }));
    expect(within(d).getByText('Milestones go from more than $0 up to $1,000,000,000,000,000.00')).toBeTruthy();
    fill(d, 'Milestone 4', 'lots');
    fireEvent.click(within(d).getByRole('button', { name: 'Save milestones' }));
    expect(within(d).getByText('"lots": Enter an amount like 1,234.56')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Remove milestone 4' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add a milestone' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Add a milestone' }));
    fill(d, 'Milestone 4', '150000');
    expect((within(d).getByRole('button', { name: 'Add a milestone' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(d).getByRole('button', { name: 'Save milestones' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tags()).toEqual(['$150k', '$250k', '$1.5M']);
    await waitFor(() => expect(estimateQuery().get('milestones')).toBe('150000,250000,1500000'));

    // None at all, then back to the two of the start.
    fireEvent.click(screen.getByRole('button', { name: 'Edit milestones' }));
    d = dialog('Edit milestones');
    for (const i of [3, 2, 1]) fireEvent.click(within(d).getByRole('button', { name: `Remove milestone ${i}` }));
    expect(within(d).getByText("No milestones: Estimate shows just where you're headed.")).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Save milestones' }));
    expect(screen.getByText('None')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit milestones' }));
    d = dialog('Edit milestones');
    fireEvent.click(within(d).getByRole('button', { name: 'Reset to $150k and $250k' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('raises the saving each year, and shows today’s dollars with inflation', async () => {
    routes['GET /api/v1/wealth/estimate'] = () =>
      json(projection({ series: [point(0, 12_345.6, 12_345.6), point(1, 25_000, 23_145.6, { realFutureValueUsd: 24_000, realNetWorthUsd: 24_000 })] }));
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');

    fireEvent.click(screen.getByText('More options'));
    const real = screen.getByLabelText("Show in today's dollars") as HTMLInputElement;
    expect(real.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Raise contributions each year (%)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Inflation (% a year)'), { target: { value: '60' } });
    expect(screen.getByText('Between 0% and 50%')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Inflation (% a year)'), { target: { value: '3,5' } });
    await waitFor(() => expect(estimateQuery().toString()).toBe('contribution=900&years=12&milestones=150000%2C250000&inflationPct=3.5&contributionGrowthPct=5'));

    fireEvent.click(real);
    expect(screen.getByText("Where you're headed, next 12 years, in today's dollars")).toBeTruthy();
    expect(screen.getByText('$24,000')).toBeTruthy();
    // Back to none: today's dollars are each year's again.
    fireEvent.change(screen.getByLabelText('Inflation (% a year)'), { target: { value: '' } });
    expect(screen.getByText('$25,000')).toBeTruthy();
  });

  it('reads each year’s figures from the chart, with the mouse or the keyboard', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');
    const chart = screen.getByRole('group', { name: 'Projection by year: use the arrow keys to read each year' });
    expect([...document.querySelectorAll('.chart-x span')].map((s) => s.textContent)).toEqual(['Now', '1y']);
    expect([...document.querySelectorAll('.chart-y span')].map((s) => s.textContent)).toEqual(['$0', '$10k', '$20k', '$30k']);

    fireEvent.focus(chart);
    const tooltip = () => document.querySelector('.chart-tooltip') as HTMLElement;
    expect(within(tooltip()).getByText('In 1 year · 2027')).toBeTruthy();
    expect(tooltip().textContent).toContain('Portfolio$25,000');
    expect(tooltip().textContent).toContain('Put in$23,146');
    expect(tooltip().textContent).toContain('Growth$1,854');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(within(tooltip()).getByText('Now · 2026')).toBeTruthy();
    fireEvent.keyDown(chart, { key: 'End' });
    expect(within(tooltip()).getByText('In 1 year · 2027')).toBeTruthy();
    fireEvent.keyDown(chart, { key: 'Home' });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'Tab' });
    expect(within(tooltip()).getByText('In 1 year · 2027')).toBeTruthy();
    fireEvent.blur(chart);
    expect(tooltip()).toBeNull();

    // The mouse: the nearest year.
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 680, top: 0, height: 260 } as DOMRect);
    fireEvent.mouseMove(chart, { clientX: 30 });
    expect(within(tooltip()).getByText('Now · 2026')).toBeTruthy();
    fireEvent.mouseLeave(chart);
    expect(tooltip()).toBeNull();
  });

  it('says what the expected return is made of, and how to set it', async () => {
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');

    const card = screen.getByText('What your expected return is made of').closest('.card') as HTMLElement;
    const byClass = within(card).getByText('By class').parentElement as HTMLElement;
    // 8,000 × 8% / 12,345.60
    expect(byClass.textContent).toContain('Equity8% a year+5.18 pts');
    expect(byClass.textContent).toContain('Goldno return set+0.00 pts');
    fireEvent.click(within(card).getByRole('button', { name: 'Set expected returns' }));
    expect(dialog('Set expected returns')).toBeTruthy();
  });

  it('lists every asset when there are many, and asks for returns when none is set', async () => {
    const many = Array.from({ length: 8 }, (_, i) => holding(`h${i}`, `Asset ${i}`, 'Cash', 'Bank', 100 + i, i));
    routes['GET /api/v1/holdings'] = () => json(many);
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');
    const byAsset = () => within(screen.getByText('By asset').parentElement as HTMLElement).getAllByRole('listitem');
    expect(byAsset()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(byAsset()).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(byAsset()).toHaveLength(6);
  });

  it('says how to set returns when none is, and when there are no assets', async () => {
    routes['GET /api/v1/wealth/summary'] = () => json(summary({ expectedReturn: { weightedPct: 0, coveragePct: 0, annualUsd: 0 } }));
    await renderApp();
    nav('Estimate');
    await screen.findByText('$25,000');
    expect(screen.getByText('No expected returns yet')).toBeTruthy();
    const growth = screen.getByText('Yearly growth').closest('.field') as HTMLElement;
    expect(growth.textContent).toContain('No expected returns set yet, so it grows at 0%.');
  });

  it('labels milestones already reached, and shows what went wrong', async () => {
    routes['GET /api/v1/wealth/estimate'] = () =>
      json(
        projection({
          milestones: [
            { amountUsd: 10000, status: 'ACHIEVED', monthsRequired: 0, targetMonth: null },
            { amountUsd: 20000, status: 'REACHABLE', monthsRequired: null, targetMonth: null },
          ],
        }),
      );
    await renderApp();
    nav('Estimate');
    expect(await screen.findByText('already there')).toBeTruthy();
    expect(screen.getAllByText('$20k').length).toBeGreaterThan(0);

    routes['GET /api/v1/wealth/estimate'] = () => json({ detail: 'years must be between 1 and 50' }, 400);
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '2' } });
    expect(await screen.findByText('years must be between 1 and 50')).toBeTruthy();
    routes['GET /api/v1/wealth/estimate'] = () => Promise.reject(new TypeError('offline'));
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '3' } });
    expect(await screen.findByText('Could not calculate the projection')).toBeTruthy();
  });

  it('shows nothing projected while it can’t be had', async () => {
    routes['GET /api/v1/wealth/estimate'] = () => Promise.reject(new TypeError('offline'));
    await renderApp();
    nav('Estimate');
    expect(await screen.findByText('Could not calculate the projection')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(document.querySelector('.chart-placeholder')).toBeTruthy();
    await act(async () => {});
    expect(HOLDINGS).toHaveLength(3);
  });
});
