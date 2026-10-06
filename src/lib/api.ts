import { ApiError } from './apiError';
import { createMockApi } from './mockApi';
import { supabase } from './supabaseClient';
import type {
  AssetClassInfo,
  AvailableAssetClasses,
  BalanceChangeReason,
  Debt,
  DebtKind,
  EstimateQuery,
  Holding,
  Movement,
  MovementKind,
  MovementPage,
  Platform,
  Preferences,
  Projection,
  Snapshot,
  ValueChangeReason,
  WealthSummary,
} from '@/types/wealth';

export { ApiError };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

interface ProblemDetail {
  type?: string;
  title?: string;
  detail?: string;
  errors?: { field: string; message: string }[];
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const { data: now } = await supabase.auth.getSession();
    const current = now.session;
    if (token && current?.access_token === token) {
      // The session Supabase handed us is no longer valid for the backend — clear it so AuthContext
      // drops back to the login screen instead of retrying with a dead token. Only here ('local'): a
      // 401 is no reason to end the user's other devices.
      await supabase.auth.signOut({ scope: 'local' });
    } else if (!isRetry && token && session?.user?.id && current?.user?.id === session.user.id) {
      // Same account, fresh token: supabase-js refreshed it while this request was out, so the 401 was
      // for the stale one. Try once more. Never when someone else has signed in on this browser since:
      // the request was made by and for the previous account.
      return request<T>(path, options, true);
    }
    throw new ApiError(401, 'Your session expired. Please sign in again.');
  }

  if (!res.ok) {
    const problem: ProblemDetail | null = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      problem?.detail ?? problem?.title ?? `Request failed with status ${res.status}`,
      problem?.errors,
      problem?.type?.split('/').pop() || undefined,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface HoldingInput {
  name: string;
  assetClass: string;
  platform: string;
  valueUsd: number;
  /** Roughly how much it grows in a year (%, -100 to 100). */
  expectedReturnPct?: number;
}

/**
 * PATCH /holdings/{id}: only the fields sent change; a new value is recorded as valueChangeReason says. A null
 * expectedReturnPct clears it.
 */
export type HoldingPatch = Partial<Omit<HoldingInput, 'expectedReturnPct'>> & {
  expectedReturnPct?: number | null;
  valueChangeReason?: ValueChangeReason;
  /** YYYY-MM-DD; now when absent. */
  occurredAt?: string;
  note?: string;
};

/** PUT /holdings/expected-returns: each holding once; null clears its return. */
export interface ExpectedReturnItem {
  holdingId: string;
  expectedReturnPct: number | null;
}

/** POST /debts: only name and balanceUsd are required. */
export interface DebtInput {
  name: string;
  lender?: string;
  kind?: DebtKind;
  balanceUsd: number;
  interestRatePct?: number;
  monthlyPaymentUsd?: number;
  dueDay?: number;
  notes?: string;
}

/**
 * PATCH /debts/{id}, a merge patch: only what's sent changes, and null clears the optional terms. A new
 * balance is recorded as balanceChangeReason says (a correction by default).
 */
export interface DebtPatch {
  name?: string;
  lender?: string | null;
  kind?: DebtKind;
  balanceUsd?: number;
  interestRatePct?: number | null;
  monthlyPaymentUsd?: number | null;
  dueDay?: number | null;
  notes?: string | null;
  balanceChangeReason?: BalanceChangeReason;
  /** YYYY-MM-DD; now when absent. */
  occurredAt?: string;
  note?: string;
}

interface MovementCommon {
  amountUsd: number;
  /** YYYY-MM-DD; now when absent. */
  occurredAt?: string;
  note?: string;
}

/**
 * POST /movements: a gain, loss, deposit or withdrawal on a holding; a transfer between two; or a debt's
 * payment (from a holding, maybe), new charge (into a holding, maybe) or interest.
 */
export type MovementInput =
  | (MovementCommon & { kind: 'GAIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL'; holdingId: string })
  | (MovementCommon & {
      kind: 'TRANSFER';
      fromHoldingId: string;
      toHoldingId?: string;
      toNewHolding?: { name: string; assetClass: string; platform: string };
      feeUsd?: number;
    })
  | (MovementCommon & { kind: 'DEBT_PAYMENT'; debtId: string; fromHoldingId?: string })
  | (MovementCommon & { kind: 'DEBT_CHARGE'; debtId: string; toHoldingId?: string })
  | (MovementCommon & { kind: 'DEBT_INTEREST'; debtId: string });

/** POST /asset-classes: a class the user doesn't have yet. */
export interface AssetClassInput {
  name: string;
  color?: string | null;
  liquid?: boolean | null;
  expectedReturnPct?: number | null;
}

/**
 * PATCH /asset-classes/{id}, a merge patch: null clears color and the return, and sets liquid back to its
 * default. A new name renames it on all its holdings; one the user has merges into it, only with mergeIfExists.
 */
export interface AssetClassPatch {
  name?: string;
  color?: string | null;
  liquid?: boolean | null;
  expectedReturnPct?: number | null;
  mergeIfExists?: boolean;
}

/**
 * PATCH /platforms/{id}, a merge patch: null sets type, avatarText and color back to their defaults. A new
 * name renames it on all its holdings; another of the user's platforms (case aside) merges into it, only with
 * mergeIfExists.
 */
export interface PlatformPatch {
  name?: string;
  type?: string | null;
  avatarText?: string | null;
  color?: string | null;
  mergeIfExists?: boolean;
}

/** GET /movements: newest first, a page at a time. */
export interface MovementQuery {
  holdingId?: string;
  debtId?: string;
  kinds?: MovementKind[];
  /** Instants (ISO) or dates (YYYY-MM-DD). */
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

const liveApi = {
  getSummary: () => request<WealthSummary>('/api/v1/wealth/summary'),

  getHoldings: () => request<Holding[]>('/api/v1/holdings'),
  createHolding: (body: HoldingInput) =>
    request<Holding>('/api/v1/holdings', { method: 'POST', body: JSON.stringify(body) }),
  updateHolding: (id: string, patch: HoldingPatch) =>
    request<Holding>(`/api/v1/holdings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteHolding: (id: string) => request<void>(`/api/v1/holdings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setExpectedReturns: (items: ExpectedReturnItem[]) =>
    request<Holding[]>('/api/v1/holdings/expected-returns', { method: 'PUT', body: JSON.stringify({ items }) }),

  getDebts: () => request<Debt[]>('/api/v1/debts'),
  createDebt: (body: DebtInput) => request<Debt>('/api/v1/debts', { method: 'POST', body: JSON.stringify(body) }),
  updateDebt: (id: string, patch: DebtPatch) =>
    request<Debt>(`/api/v1/debts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteDebt: (id: string) => request<void>(`/api/v1/debts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getMovements: (query: MovementQuery = {}) => {
    const params = new URLSearchParams();
    if (query.holdingId) params.set('holdingId', query.holdingId);
    if (query.debtId) params.set('debtId', query.debtId);
    if (query.kinds?.length) params.set('kind', query.kinds.join(','));
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    const search = params.toString();
    return request<MovementPage>(`/api/v1/movements${search ? `?${search}` : ''}`);
  },
  createMovement: (input: MovementInput) =>
    request<Movement>('/api/v1/movements', { method: 'POST', body: JSON.stringify(input) }),
  deleteMovement: (id: string) => request<void>(`/api/v1/movements/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getPlatforms: () => request<Platform[]>('/api/v1/platforms'),
  updatePlatform: (id: string, patch: PlatformPatch) =>
    request<Platform>(`/api/v1/platforms/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getAssetClasses: () => request<AvailableAssetClasses>('/api/v1/asset-classes'),
  createAssetClass: (body: AssetClassInput) =>
    request<AssetClassInfo>('/api/v1/asset-classes', { method: 'POST', body: JSON.stringify(body) }),
  updateAssetClass: (id: string, patch: AssetClassPatch) =>
    request<AssetClassInfo>(`/api/v1/asset-classes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  /** Its holdings, if any, move to moveTo. */
  deleteAssetClass: (id: string, moveTo?: string) =>
    request<void>(
      `/api/v1/asset-classes/${encodeURIComponent(id)}${moveTo === undefined ? '' : `?moveTo=${encodeURIComponent(moveTo)}`}`,
      { method: 'DELETE' },
    ),

  getSnapshots: () => request<Snapshot[]>('/api/v1/wealth/snapshots'),
  createSnapshot: () => request<Snapshot>('/api/v1/wealth/snapshots', { method: 'POST' }),
  deleteSnapshot: (id: string) => request<void>(`/api/v1/wealth/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getEstimate: (params: EstimateQuery) => {
    const query = new URLSearchParams({ contribution: String(params.contribution), years: String(params.years) });
    if (params.yieldPct !== undefined) query.set('yieldPct', String(params.yieldPct));
    if (params.milestones) query.set('milestones', params.milestones.join(','));
    if (params.inflationPct) query.set('inflationPct', String(params.inflationPct));
    if (params.contributionGrowthPct) query.set('contributionGrowthPct', String(params.contributionGrowthPct));
    return request<Projection>(`/api/v1/wealth/estimate?${query}`);
  },

  getPreferences: () => request<Preferences>('/api/v1/preferences'),
  savePreferences: (preferences: Preferences) =>
    request<Preferences>('/api/v1/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),
};

export type Api = typeof liveApi;

// On mock data (Vercel previews, see next.config.mjs) nothing is fetched: the same calls, answered in
// memory. Spelled out rather than imported, so production builds compile the mock away.
export const api: Api = process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock' ? createMockApi() : liveApi;
