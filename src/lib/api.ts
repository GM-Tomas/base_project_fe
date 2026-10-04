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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

interface ProblemDetail {
  title?: string;
  detail?: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(status: number, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // The session Supabase handed us is no longer valid for the backend — clear it so AuthContext
    // drops back to the login screen instead of retrying with a dead token. Only if it's still the
    // current one, though: by the time a slow request answers, someone else may have signed in on
    // this browser. And only here ('local'): a 401 is no reason to end the user's other devices.
    const { data: current } = await supabase.auth.getSession();
    if (token && current.session?.access_token === token) {
      await supabase.auth.signOut({ scope: 'local' });
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

export const api = {
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
