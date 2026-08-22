'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';

export const Login: React.FC<{ onSkip?: () => void }> = ({ onSkip }) => {
  const { signInWithGoogle } = useAuth();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '320px' }}>
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 18px' }}>
          <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" stroke="var(--color-accent)" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="5.5" fill="var(--color-accent)" opacity="0.9" />
        </svg>
        <h4 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 600, color: 'var(--color-text)' }}>
          BASE
        </h4>
        <div
          style={{
            fontSize: '13px',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            marginBottom: '26px',
          }}
        >
          Sign in to see your full financial picture.
        </div>
        <button
          onClick={signInWithGoogle}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#fff" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
          >
            Skip login (dev)
          </button>
        )}
      </div>
    </div>
  );
};
