import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthClient } from './supabaseClient';

const demoSession: Session = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'demo-user',
    aud: 'authenticated',
    email: 'demo@example.com',
    app_metadata: {},
    user_metadata: { full_name: 'Demo account' },
    created_at: '2026-01-01T00:00:00Z',
  },
};

// Sign-in on mock data: a demo account is signed in from the start, signing out works, and any email and
// password sign back in. Nothing reaches Supabase.
export function createDemoAuth(): AuthClient {
  let session: Session | null = demoSession;
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
  const change = (event: AuthChangeEvent, next: Session | null) => {
    session = next;
    listeners.forEach((listener) => listener(event, session));
  };

  return {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => void listeners.delete(callback) } } };
    },
    signInWithPassword: async () => {
      change('SIGNED_IN', demoSession);
      return { error: null };
    },
    signOut: async () => {
      change('SIGNED_OUT', null);
      return { error: null };
    },
  };
}
