import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import { createDemoAuth } from './mockAuth';

// The part of supabase-js auth the app uses: the real client, or on mock data a demo one (mockAuth.ts).
export interface AuthClient {
  getSession(): Promise<{ data: { session: Session | null } }>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<unknown>;
}

// Auth only. Sign-ups are disabled in the Supabase project itself (Authentication > Sign In /
// Providers > "Allow new users to sign up" off): accounts are created from the dashboard and this
// app only ever calls signInWithPassword / signOut. On mock data (see next.config.mjs) it's a demo
// account instead; the check is spelled out, not imported, so production builds compile the demo away.
export const supabase: { auth: AuthClient } =
  process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock'
    ? { auth: createDemoAuth() }
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: {
          // Password sign-in never redirects back with tokens, so never adopt a session from the URL. With
          // the default, a link carrying someone else's #access_token=…&refresh_token=… silently signs the
          // visitor into that account, and whatever they then enter lands in it.
          detectSessionInUrl: false,
        },
      });
