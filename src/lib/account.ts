import type { User } from '@supabase/supabase-js';

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// How the UI names the signed-in account. user_metadata is editable by the user themselves, so only
// plain strings are used, and only as text shown back to that same user. No avatar image: accounts are
// email/password and the CSP blocks remote images anyway.
export function accountLabel(user: User | null): { name: string; initial: string } {
  const name = text(user?.user_metadata?.full_name) ?? text(user?.user_metadata?.name) ?? text(user?.email) ?? 'Account';
  return { name, initial: Array.from(name)[0].toUpperCase() }; // a whole character, even outside the BMP
}
