import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Supabase is the only external boundary besides fetch: every test gets a fresh, inert auth mock.
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
