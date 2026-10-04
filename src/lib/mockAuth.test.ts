import { describe, expect, it, vi } from 'vitest';
import { createDemoAuth } from './mockAuth';

describe('demo sign-in (mock data)', () => {
  it('starts signed in, signs out, and lets any credentials back in', async () => {
    const auth = createDemoAuth();
    const listener = vi.fn();
    const { data } = auth.onAuthStateChange(listener);

    const { data: start } = await auth.getSession();
    expect(start.session?.user).toMatchObject({ id: 'demo-user', email: 'demo@example.com' });

    await auth.signOut({ scope: 'local' });
    expect(listener).toHaveBeenLastCalledWith('SIGNED_OUT', null);
    expect((await auth.getSession()).data.session).toBeNull();

    await expect(auth.signInWithPassword({ email: 'anyone@example.com', password: 'x' })).resolves.toEqual({ error: null });
    expect(listener).toHaveBeenLastCalledWith('SIGNED_IN', start.session);
    expect((await auth.getSession()).data.session).toBe(start.session);

    data.subscription.unsubscribe();
    await auth.signOut();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
