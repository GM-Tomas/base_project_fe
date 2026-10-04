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

  it('builds the estimate query string', async () => {
    fetchMock.mockResolvedValue(json({}));
    await api.getEstimate({ contribution: 900, yieldPct: 9.5, years: 12 });
    expect(lastCall().url).toBe('http://localhost:8080/api/v1/wealth/estimate?contribution=900&yieldPct=9.5&years=12');
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
