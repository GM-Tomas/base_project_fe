'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { translateApiMessage } from '@/i18n/apiErrors';
import { language, useLanguage } from '@/lib/i18n';

interface PendingRecovery {
  access_token: string;
  refresh_token: string;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  recoveringPassword: boolean;
  recoveryEmail: string | null;
  authError: string | null;
  clearAuthError: () => void;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  cancelPasswordRecovery: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RECOVERY_LOCK_KEY = 'base.recovering';

function hasRecoveryLock(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(RECOVERY_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function setRecoveryLock(locked: boolean) {
  try {
    if (locked) localStorage.setItem(RECOVERY_LOCK_KEY, '1');
    else localStorage.removeItem(RECOVERY_LOCK_KEY);
  } catch {
    // Storage blocked: the in-memory flag still holds for this tab.
  }
}

// Verify that a recovery link's JWT carries GoTrue's one-time recovery AMR claim ("otp" in GoTrue's
// mfa_amr_claims table for /auth/v1/verify links, or "recovery") and not a regular "password" login,
// so a password-login token disguised with `&type=recovery` is rejected before touching storage.
export function parseRecoveryJwt(token: string): { valid: boolean; email: string | null } {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, email: null };
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { email?: unknown; amr?: Array<{ method?: string }> };
    const isRecovery =
      Array.isArray(payload.amr) &&
      payload.amr.every((entry) => entry?.method !== 'password') &&
      payload.amr.some((entry) => entry?.method === 'otp' || entry?.method === 'recovery');
    return { valid: isRecovery, email: typeof payload.email === 'string' ? payload.email : null };
  } catch {
    return { valid: false, email: null };
  }
}

function parseUrlHash(): { recovery: PendingRecovery | null; error: string | null; scrub: boolean } {
  if (typeof window === 'undefined' || window.location.hash.length <= 1) {
    return { recovery: null, error: null, scrub: false };
  }
  const params = new URLSearchParams(window.location.hash.slice(1));
  const errorDesc = params.get('error_description');
  if (errorDesc || params.get('error_code') || params.get('error')) {
    return {
      recovery: null,
      error: errorDesc ? errorDesc.replace(/\+/g, ' ') : 'Email link is invalid or has expired',
      scrub: true,
    };
  }
  if (params.get('type') === 'recovery') {
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const jwt = parseRecoveryJwt(access_token);
      if (jwt.valid) {
        return { recovery: { access_token, refresh_token, email: jwt.email }, error: null, scrub: true };
      }
    }
    return { recovery: null, error: 'Email link is invalid or has expired', scrub: true };
  }
  const hasTokens = params.has('access_token') || params.has('refresh_token');
  return { recovery: null, error: null, scrub: hasTokens };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialHash] = useState(parseUrlHash);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery | null>(initialHash.recovery);
  const [rawUrlError, setRawUrlError] = useState<string | null>(initialHash.error);
  const [sessionLockedForRecovery, setSessionLockedForRecovery] = useState(hasRecoveryLock);
  const currentLanguage = useLanguage();

  useEffect(() => {
    if (initialHash.scrub && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (!data.session) {
          setRecoveryLock(false);
          setSessionLockedForRecovery(false);
        }
      })
      // Unreadable stored session (e.g. storage blocked): start signed out instead of a blank page forever.
      .catch(() => {
        setSession(null);
        setRecoveryLock(false);
        setSessionLockedForRecovery(false);
      })
      .finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryLock(true);
        setSessionLockedForRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setRecoveryLock(false);
        setSessionLockedForRecovery(false);
      }
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === RECOVERY_LOCK_KEY || e.key === null) {
        setSessionLockedForRecovery(hasRecoveryLock());
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [initialHash.scrub]);

  const recoveringPassword = pendingRecovery !== null || sessionLockedForRecovery;
  const recoveryEmail =
    pendingRecovery?.email ?? (sessionLockedForRecovery ? (session?.user?.email ?? null) : null);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        loading,
        recoveringPassword,
        recoveryEmail,
        authError: rawUrlError ? translateApiMessage(rawUrlError, currentLanguage) : null,
        clearAuthError: () => setRawUrlError(null),
        signInWithPassword: async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return error?.message ? translateApiMessage(error.message, language()) : null;
        },
        requestPasswordReset: async (email) => {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          return error?.message ? translateApiMessage(error.message, language()) : null;
        },
        updatePassword: async (password) => {
          if (pendingRecovery) {
            setRecoveryLock(true);
            setSessionLockedForRecovery(true);
            const tokens = pendingRecovery;
            setPendingRecovery(null);
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            });
            if (sessionError) {
              setRecoveryLock(false);
              setSessionLockedForRecovery(false);
              return translateApiMessage(sessionError.message || 'Email link is invalid or has expired', language());
            }
          }
          const { error } = await supabase.auth.updateUser({ password });
          if (error?.message) return translateApiMessage(error.message, language());
          setRecoveryLock(false);
          setSessionLockedForRecovery(false);
          // Revoke refresh tokens on other devices after a password reset while keeping this browser signed in.
          void Promise.resolve(supabase.auth.signOut({ scope: 'others' })).catch(() => {});
          return null;
        },
        cancelPasswordRecovery: () => {
          setPendingRecovery(null);
          if (sessionLockedForRecovery) {
            setRecoveryLock(false);
            setSessionLockedForRecovery(false);
            void supabase.auth.signOut({ scope: 'local' });
          }
        },
        // This browser only: on a shared computer, switching accounts mustn't end the user's other devices.
        signOut: () => {
          setPendingRecovery(null);
          setRecoveryLock(false);
          setSessionLockedForRecovery(false);
          void supabase.auth.signOut({ scope: 'local' });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
