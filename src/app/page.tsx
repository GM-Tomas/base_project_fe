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
import { MonthlyCheckpoint } from '@/components/app/MonthlyCheckpoint';
import { Hotkeys } from '@/components/app/Hotkeys';
import { ViewBoundary } from '@/components/app/ViewBoundary';
import { AppSkeleton } from '@/components/app/AppSkeleton';
import { BottomNav } from '@/components/layout/BottomNav';
import { NARROW, useMediaQuery } from '@/lib/useMediaQuery';

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

// Saving the preferences happens in the background: say so when it fails (the next change saves them).
function PreferencesSaveFailures() {
  const { preferencesSaveFailures } = useWealth();
  const { toast } = useUi();
  useEffect(() => {
    if (preferencesSaveFailures > 0) toast.error("Couldn't save your settings. They'll be saved with your next change.");
  }, [preferencesSaveFailures, toast]);
  return null;
}

function Dashboard() {
  const { view, loading: dataLoading, loadError, retry, refresh } = useWealth();
  const { user, signOut } = useAuth();
  const narrow = useMediaQuery(NARROW);

  if (dataLoading) return <AppSkeleton />;

  if (loadError) {
    return (
      <div className="app-message">
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
    <div className={narrow ? 'app-shell app-shell-narrow' : 'app-shell'}>
      <PreferencesSaveFailures />
      <MonthlyCheckpoint />
      <Hotkeys />

      {!narrow && <Sidebar />}

      <main className="app-main">
        <Header />

        {/* The view: one that fails to render is replaced by a message, the rest of the app keeps working. */}
        <div className="app-content">
          <ViewBoundary key={view} onReload={() => void refresh().catch(() => {})}>
            {view === 'dashboard' && <DashboardView />}
            {view === 'platforms' && <PlatformsView />}
            {view === 'assets' && <AssetsView />}
            {view === 'debts' && <DebtsView />}
            {view === 'estimate' && <EstimateView />}
            {view === 'history' && <HistoryView />}
            {view === 'settings' && <SettingsView />}
          </ViewBoundary>
        </div>
      </main>

      {narrow && <BottomNav />}
    </div>
  );
}
