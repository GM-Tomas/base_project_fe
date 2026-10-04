import { ApiError } from './apiError';
import { createMockApi } from './mockApi';
import { supabase } from './supabaseClient';
import type {
  AvailableAssetClasses,
  EstimateParams,
  Holding,
  Platform,
  Projection,
  Snapshot,
  WealthSummary,
} from '@/types/wealth';

export { ApiError };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

interface ProblemDetail {
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
}

const liveApi = {
  getSummary: () => request<WealthSummary>('/api/v1/wealth/summary'),

  getHoldings: () => request<Holding[]>('/api/v1/holdings'),
  createHolding: (body: HoldingInput) =>
    request<Holding>('/api/v1/holdings', { method: 'POST', body: JSON.stringify(body) }),
  deleteHolding: (id: string) => request<void>(`/api/v1/holdings/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getPlatforms: () => request<Platform[]>('/api/v1/platforms'),
  getAssetClasses: () => request<AvailableAssetClasses>('/api/v1/asset-classes'),

  getSnapshots: () => request<Snapshot[]>('/api/v1/wealth/snapshots'),
  createSnapshot: () => request<Snapshot>('/api/v1/wealth/snapshots', { method: 'POST' }),

  getEstimate: (params: EstimateParams) => {
    const query = new URLSearchParams({
      contribution: String(params.contribution),
      yieldPct: String(params.yieldPct),
      years: String(params.years),
    });
    return request<Projection>(`/api/v1/wealth/estimate?${query}`);
  },
};

export type Api = typeof liveApi;

// On mock data (Vercel previews, see next.config.mjs) nothing is fetched: the same calls, answered in
// memory. Spelled out rather than imported, so production builds compile the mock away.
export const api: Api = process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock' ? createMockApi() : liveApi;
