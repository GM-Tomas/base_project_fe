import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// setup.ts mocks this module for every other test; here the real one runs against a fake SDK.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }));

describe('supabase client', () => {
  it('is built from the env and never adopts a session from the URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');

    const { supabase } = await vi.importActual<typeof import('./supabaseClient')>('./supabaseClient');

    expect(supabase).toBeDefined();
    expect(createClient).toHaveBeenCalledWith('https://ref.supabase.co', 'sb_publishable_x', {
      auth: { detectSessionInUrl: false },
    });
    vi.unstubAllEnvs();
  });
});
