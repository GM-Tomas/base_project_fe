'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Login } from '@/components/auth/Login';
import { DashboardView } from '@/components/views/DashboardView';
import { PlatformsView } from '@/components/views/PlatformsView';
import { AssetsView } from '@/components/views/AssetsView';
import { EstimateView } from '@/components/views/EstimateView';
import { HistoryView } from '@/components/views/HistoryView';
import { AddAssetModal } from '@/components/modals/AddAssetModal';

const canSkipLogin = process.env.NODE_ENV !== 'production';

export default function HomePage() {
  const { view, loading: dataLoading, loadError } = useWealth();
  const { user, loading: authLoading } = useAuth();
  const [skipped, setSkipped] = useState(false);

  if (authLoading) return null;
  if (!user && !(canSkipLogin && skipped)) {
    return <Login onSkip={canSkipLogin ? () => setSkipped(true) : undefined} />;
  }

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
        <div>Couldn&apos;t reach the server: {loadError}</div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
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
          {view === 'estimate' && <EstimateView />}
          {view === 'history' && <HistoryView />}
        </div>
      </main>

      {/* Add Asset Dialog */}
      <AddAssetModal />
    </div>
  );
}
