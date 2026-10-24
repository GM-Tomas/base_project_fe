'use client';

import React, { useId, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usesMockData } from '@/lib/dataSource';
import { LANGUAGE_SETTINGS, languageSetting, setLanguageSetting, useLanguage, useT, type LanguageSetting } from '@/lib/i18n';

const MIN_PASSWORD_LENGTH = 8;

export const Login: React.FC<{ onSkip?: () => void }> = ({ onSkip }) => {
  const {
    signInWithPassword,
    requestPasswordReset,
    updatePassword,
    cancelPasswordRecovery,
    recoveringPassword,
    recoveryEmail,
    authError,
    clearAuthError,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tAll = useT();
  const t = tAll.login;
  // Before there's an account, the language is this device's.
  useLanguage();
  const ids = {
    email: useId(),
    password: useId(),
    newPassword: useId(),
    confirmPassword: useId(),
    language: useId(),
  };

  const shownError = error || authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    setIsSubmitting(true);
    const errorMessage = await signInWithPassword(email, password);
    setIsSubmitting(false);
    if (errorMessage) setError(errorMessage);
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    setIsSubmitting(true);
    const errorMessage = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (errorMessage) setError(errorMessage);
    else setResetSent(true);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordsDontMatch);
      return;
    }
    setIsSubmitting(true);
    const errorMessage = await updatePassword(newPassword);
    setIsSubmitting(false);
    if (errorMessage) setError(errorMessage);
  };

  const backToSignIn = () => {
    setError('');
    clearAuthError();
    setForgotPassword(false);
    setResetSent(false);
    setNewPassword('');
    setConfirmPassword('');
    if (recoveringPassword) cancelPasswordRecovery();
  };

  const intro = recoveringPassword
    ? recoveryEmail
      ? t.newPasswordFor(recoveryEmail)
      : t.newPasswordIntro
    : forgotPassword
      ? t.resetIntro
      : usesMockData
        ? t.demoIntro
        : t.intro;

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
          {intro}
        </div>

        {recoveringPassword ? (
          <>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              {shownError && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--color-negative) 18%, transparent)',
                    color: 'var(--color-negative)',
                    fontSize: '13px',
                  }}
                >
                  {shownError}
                </div>
              )}

              <div className="field">
                <label htmlFor={ids.newPassword}>{t.newPassword}</label>
                <input
                  id={ids.newPassword}
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="field">
                <label htmlFor={ids.confirmPassword}>{t.confirmPassword}</label>
                <input
                  id={ids.confirmPassword}
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
              >
                {isSubmitting ? t.savingPassword : t.savePassword}
              </button>
            </form>

            <button
              type="button"
              onClick={backToSignIn}
              className="btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
            >
              {t.backToSignIn}
            </button>
          </>
        ) : forgotPassword ? (
          resetSent ? (
            <>
              <div
                role="status"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                {t.resetSent}
              </div>
              <button
                type="button"
                onClick={backToSignIn}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
              >
                {t.backToSignIn}
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                {shownError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'color-mix(in srgb, var(--color-negative) 18%, transparent)',
                      color: 'var(--color-negative)',
                      fontSize: '13px',
                    }}
                  >
                    {shownError}
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

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
                >
                  {isSubmitting ? t.sendingResetLink : t.sendResetLink}
                </button>
              </form>

              <button
                type="button"
                onClick={backToSignIn}
                className="btn"
                style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              >
                {t.backToSignIn}
              </button>
            </>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              {shownError && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--color-negative) 18%, transparent)',
                    color: 'var(--color-negative)',
                    fontSize: '13px',
                  }}
                >
                  {shownError}
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
                disabled={isSubmitting}
                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
              >
                {isSubmitting ? t.signingIn : t.signIn}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setError('');
                clearAuthError();
                setForgotPassword(true);
              }}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px', fontSize: '13px' }}
            >
              {t.forgotPassword}
            </button>

            {onSkip && (
              <button
                onClick={onSkip}
                className="btn"
                style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
              >
                {t.skip}
              </button>
            )}
          </>
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
