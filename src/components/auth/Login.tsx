'use client';

import React, { useId, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usesMockData } from '@/lib/dataSource';
import { LANGUAGE_SETTINGS, languageSetting, setLanguageSetting, useLanguage, useT, type LanguageSetting } from '@/lib/i18n';

export const Login: React.FC<{ onSkip?: () => void }> = ({ onSkip }) => {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const tAll = useT();
  const t = tAll.login;
  // Before there's an account, the language is this device's.
  useLanguage();
  const ids = { email: useId(), password: useId(), language: useId() };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSigningIn(true);
    const errorMessage = await signInWithPassword(email, password);
    setIsSigningIn(false);
    if (errorMessage) setError(errorMessage);
  };

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
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
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
          {usesMockData ? t.demoIntro : t.intro}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--color-negative) 18%, transparent)',
                color: 'var(--color-negative)',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor={ids.email}>{t.email}</label>
            <input
              id={ids.email}
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label htmlFor={ids.password}>{t.password}</label>
            <input
              id={ids.password}
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSigningIn}
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          >
            {isSigningIn ? t.signingIn : t.signIn}
          </button>
        </form>

        {onSkip && (
          <button
            onClick={onSkip}
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
          >
            {t.skip}
          </button>
        )}

        <div className="login-language">
          <label htmlFor={ids.language}>{t.language}</label>
          <select
            id={ids.language}
            className="input"
            value={languageSetting()}
            onChange={(e) => setLanguageSetting(e.target.value as LanguageSetting)}
          >
            {LANGUAGE_SETTINGS.map((l) => (
              <option key={l} value={l}>
                {tAll.settings.languages[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
