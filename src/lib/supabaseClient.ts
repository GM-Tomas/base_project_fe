import { createClient } from '@supabase/supabase-js';

// Auth only. Sign-ups are disabled in the Supabase project itself (Authentication > Sign In /
// Providers > "Allow new users to sign up" off): accounts are created from the dashboard and this
// app only ever calls signInWithPassword / signOut.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
