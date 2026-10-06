import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { supabase } from './supabaseClient';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'tok' } },
  } as never);
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: init as RequestInit & { headers: Record<string, string> } };
};

describe('api', () => {
  it('sends the bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValue(json([{ id: 'h1' }]));

    await expect(api.getHoldings()).resolves.toEqual([{ id: 'h1' }]);

    const { url, init } = lastCall();
    expect(url).toBe('http://localhost:8080/api/v1/holdings');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('omits Authorization without a session and sets Content-Type only with a body', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
    fetchMock.mockResolvedValue(json({ id: 'h1' }, 201));

    await api.createHolding({ name: 'SPY', assetClass: 'Equity', platform: 'IBKR', valueUsd: 10 });

    const { init } = lastCall();
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ name: 'SPY', assetClass: 'Equity', platform: 'IBKR', valueUsd: 10 });
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.deleteHolding('h1')).resolves.toBeUndefined();
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/holdings/h1');
    expect(lastCall().init.method).toBe('DELETE');
  });

  it('signs out (this browser only) and throws on 401', async () => {
    fetchMock.mockResolvedValue(json({}, 401));

    const err = await api.getSummary().catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'Your session expired. Please sign in again.' });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never signs out, nor retries as, an account that signed in after the rejected request was sent', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } } as never);
    let answer!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
    const pending = api.createHolding({ name: 'SPY', assetClass: 'Equity', platform: 'IBKR', valueUsd: 10 }).catch((e) => e);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Meanwhile: signed out, and someone else signed in on this browser.
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'other', user: { id: 'u2' } } } } as never);
    answer(json({}, 401));

    expect(await pending).toMatchObject({ status: 401 });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with the token supabase-js refreshed for the same account', async () => {
    vi.mocked(supabase.auth.getSession)
      .mockResolvedValueOnce({ data: { session: { access_token: 'old', user: { id: 'u1' } } } } as never)
      .mockResolvedValue({ data: { session: { access_token: 'new', user: { id: 'u1' } } } } as never);
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ id: 'h1' }, 201));

    await expect(api.createHolding({ name: 'SPY', assetClass: 'Equity', platform: 'IBKR', valueUsd: 10 })).resolves.toEqual({ id: 'h1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retry] = fetchMock.mock.calls[1];
    expect(retry.headers.Authorization).toBe('Bearer new');
    expect(JSON.parse(retry.body)).toEqual({ name: 'SPY', assetClass: 'Equity', platform: 'IBKR', valueUsd: 10 });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('retries only once: a refreshed token that is rejected too signs out', async () => {
    vi.mocked(supabase.auth.getSession)
      .mockResolvedValueOnce({ data: { session: { access_token: 'old', user: { id: 'u1' } } } } as never)
      .mockResolvedValue({ data: { session: { access_token: 'new', user: { id: 'u1' } } } } as never);
    fetchMock.mockResolvedValue(json({}, 401));

    await expect(api.getHoldings()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never loops, even if the token keeps changing under it', async () => {
    let n = 0;
    vi.mocked(supabase.auth.getSession).mockImplementation(
      async () => ({ data: { session: { access_token: `tok-${n++}`, user: { id: 'u1' } } } }) as never,
    );
    fetchMock.mockResolvedValue(json({}, 401));

    await expect(api.getHoldings()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('has nothing to sign out on a 401 without a session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
    fetchMock.mockResolvedValue(json({}, 401));

    await expect(api.getHoldings()).rejects.toMatchObject({ status: 401 });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('surfaces problem detail, then title, then a generic message', async () => {
    const errors = [{ field: 'name', message: 'required' }];
    fetchMock.mockResolvedValueOnce(json({ title: 'Bad Request', detail: 'name is required', errors }, 400));
    await expect(api.createSnapshot()).rejects.toMatchObject({ status: 400, message: 'name is required', errors });

    fetchMock.mockResolvedValueOnce(json({ title: 'Conflict' }, 409));
    await expect(api.createSnapshot()).rejects.toMatchObject({ status: 409, message: 'Conflict' });

    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 502 }));
    await expect(api.getSnapshots()).rejects.toMatchObject({ status: 502, message: 'Request failed with status 502' });
  });

  it('builds the estimate query string: only what is set', async () => {
    fetchMock.mockImplementation(async () => json({}));
    await api.getEstimate({ contribution: 900, years: 12 });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/wealth/estimate?contribution=900&years=12');
    await api.getEstimate({
      contribution: 900,
      years: 12,
      yieldPct: -2.5,
      milestones: [150_000, 1e6],
      inflationPct: 3,
      contributionGrowthPct: 5,
    });
    expect(lastCall().url).toBe(
      'http://localhost:8080/api/v1/wealth/estimate?contribution=900&years=12&yieldPct=-2.5&milestones=150000%2C1000000&inflationPct=3&contributionGrowthPct=5',
    );
    // No milestones at all is an empty list; no inflation or raise isn't sent.
    await api.getEstimate({ contribution: 0, years: 1, milestones: [], inflationPct: 0, contributionGrowthPct: 0 });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/wealth/estimate?contribution=0&years=1&milestones=');
  });

  it('sets expected returns, and reads and saves preferences', async () => {
    fetchMock.mockImplementation(async () => json([]));
    await api.setExpectedReturns([{ holdingId: 'h1', expectedReturnPct: null }]);
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/holdings/expected-returns');
    expect(lastCall().init.method).toBe('PUT');
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ items: [{ holdingId: 'h1', expectedReturnPct: null }] });

    fetchMock.mockImplementation(async () => json({ estimate: {} }));
    await api.getPreferences();
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/preferences');
    await api.savePreferences({ estimate: { years: 20 } } as never);
    expect(lastCall().init.method).toBe('PUT');
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ estimate: { years: 20 } });
  });

  it('builds the activity query: only the filters given, kinds comma-separated', async () => {
    fetchMock.mockImplementation(async () => json({ items: [], nextCursor: null }));
    await api.getMovements();
    await api.getMovements({ holdingId: 'h 1', kinds: ['GAIN', 'LOSS'], from: '2026-01-01', to: '2026-03-31', limit: 20, cursor: 'c/1' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/v1/movements',
      'http://localhost:8080/api/v1/movements?holdingId=h+1&kind=GAIN%2CLOSS&from=2026-01-01&to=2026-03-31&limit=20&cursor=c%2F1',
    ]);
  });

  it("asks what a period's movements add up to: all time, or between two instants", async () => {
    fetchMock.mockImplementation(async () => json({ count: 0 }));
    await api.getMovementsSummary();
    await api.getMovementsSummary({ from: '2026-01-15T12:00:00.000Z', to: '2026-05-01T15:00:00.000Z' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/v1/movements/summary',
      'http://localhost:8080/api/v1/movements/summary?from=2026-01-15T12%3A00%3A00.000Z&to=2026-05-01T15%3A00%3A00.000Z',
    ]);
  });

  it("saves today's snapshot with no body, and a past one with its figures", async () => {
    fetchMock.mockImplementation(async () => json({ id: 's1' }, 201));
    await api.createSnapshot();
    expect(lastCall().init.method).toBe('POST');
    expect(lastCall().init.body).toBeUndefined();
    await api.createSnapshot({ capturedAt: '2025-12-31T12:00:00.000Z', totalValueUsd: -2_500, note: 'From my spreadsheet' });
    expect(lastCall().init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(lastCall().init.body))).toEqual({
      capturedAt: '2025-12-31T12:00:00.000Z',
      totalValueUsd: -2_500,
      note: 'From my spreadsheet',
    });
  });

  it('records and undoes movements', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'm1' }, 201)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.createMovement({ kind: 'GAIN', holdingId: 'h1', amountUsd: 5 })).resolves.toEqual({ id: 'm1' });
    expect(lastCall().init.method).toBe('POST');
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ kind: 'GAIN', holdingId: 'h1', amountUsd: 5 });
    await api.deleteMovement('m/1');
    expect(lastCall()).toMatchObject({ url: 'http://localhost:8080/api/v1/movements/m%2F1', init: { method: 'DELETE' } });
  });

  it('hits the remaining read endpoints', async () => {
    fetchMock.mockImplementation(async () => json({}));
    await api.getPlatforms();
    await api.getAssetClasses();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/v1/platforms',
      'http://localhost:8080/api/v1/asset-classes',
    ]);
  });
});

describe('api: classes and platforms', () => {
  it('creates, edits and removes classes, the id escaped and moveTo in the query', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'QXJ0', name: 'Art' }));
    await api.createAssetClass({ name: 'Art', color: '#aabbcc', liquid: false });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/asset-classes');
    expect(lastCall().init.method).toBe('POST');
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ name: 'Art', color: '#aabbcc', liquid: false });

    await api.updateAssetClass('a/b', { name: 'Equity', mergeIfExists: true, color: null });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/asset-classes/a%2Fb');
    expect(lastCall().init.method).toBe('PATCH');
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ name: 'Equity', mergeIfExists: true, color: null });

    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await api.deleteAssetClass('QXJ0');
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/asset-classes/QXJ0');
    expect(lastCall().init.method).toBe('DELETE');
    await api.deleteAssetClass('QXJ0', 'Real Estate & Land');
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/asset-classes/QXJ0?moveTo=Real%20Estate%20%26%20Land');
  });

  it('customizes a platform', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'YmluYW5jZQ', name: 'Binance' }));
    await api.updatePlatform('YmluYW5jZQ', { avatarText: '🟡', color: null });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/platforms/YmluYW5jZQ');
    expect(lastCall().init.method).toBe('PATCH');
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ avatarText: '🟡', color: null });
  });

  it("tells what kind of problem it was, from the problem's type", async () => {
    fetchMock.mockResolvedValue(
      json({ type: 'https://base.wealth/errors/class-exists', title: 'Conflict', status: 409, detail: 'There\'s already a class named "Equity"' }, 409),
    );
    const err = await api.updateAssetClass('x', { name: 'Equity' }).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'class-exists', message: 'There\'s already a class named "Equity"' });

    fetchMock.mockResolvedValue(json({ title: 'Conflict' }, 409));
    expect(await api.updateAssetClass('x', {}).catch((e) => e.code)).toBeUndefined();
  });
});
