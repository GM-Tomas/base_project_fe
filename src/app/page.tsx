'use client';

import React, { useEffect, useState } from 'react';
import { useWealth, WealthProvider } from '@/context/WealthContext';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Login } from '@/components/auth/Login';
import { DashboardView } from '@/components/views/DashboardView';
import { PlatformsView } from '@/components/views/PlatformsView';
import { AssetsView } from '@/components/views/AssetsView';
import { DebtsView } from '@/components/views/DebtsView';
import { EstimateView } from '@/components/views/EstimateView';
import { HistoryView } from '@/components/views/HistoryView';
import { SettingsView } from '@/components/views/SettingsView';
import { UiProvider, useUi } from '@/context/UiContext';

const canSkipLogin = process.env.NODE_ENV !== 'production';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [skipped, setSkipped] = useState(false);

  if (authLoading) return null;
  if (!user && !(canSkipLogin && skipped)) {
    return <Login onSkip={canSkipLogin ? () => setSkipped(true) : undefined} />;
  }

  // Mounted only once there is a session (and keyed by user): data loads right after sign-in, and
  // signing out unmounts it, so the next account never sees the previous one's numbers (nor its open
  // dialogs and toasts).
  return (
    <WealthProvider key={user?.id}>
      <UiProvider>
        <Dashboard />
      </UiProvider>
    </WealthProvider>
  );
}

// Saving Estimate's settings happens in the background: say so when it fails (the next change saves them).
function PreferencesSaveFailures() {
  const { preferencesSaveFailures } = useWealth();
  const { toast } = useUi();
  useEffect(() => {
    if (preferencesSaveFailures > 0) toast.error("Couldn't save your Estimate settings. They'll be saved with your next change.");
  }, [preferencesSaveFailures, toast]);
  return null;
}

function Dashboard() {
  const { view, loading: dataLoading, loadError, retry } = useWealth();
  const { user, signOut } = useAuth();

  if (dataLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        Loading your data…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          height: '100vh',
          width: '100vw',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        <div>{loadError}</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => void retry()}>
            Retry
          </button>
          {/* Without the dashboard there's no profile menu: still let people switch accounts. */}
          {user && (
            <button className="btn btn-secondary" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'inherit',
        fontSize: '15px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background Grid Accent Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          opacity: 0.5,
        }}
      />

      <PreferencesSaveFailures />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <Header />

        {/* Scrollable View Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '26px 28px 60px',
          }}
        >
          {view === 'dashboard' && <DashboardView />}
          {view === 'platforms' && <PlatformsView />}
          {view === 'assets' && <AssetsView />}
          {view === 'debts' && <DebtsView />}
          {view === 'estimate' && <EstimateView />}
          {view === 'history' && <HistoryView />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}
