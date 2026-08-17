'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DashboardView } from '@/components/views/DashboardView';
import { PlatformsView } from '@/components/views/PlatformsView';
import { AssetsView } from '@/components/views/AssetsView';
import { EstimateView } from '@/components/views/EstimateView';
import { HistoryView } from '@/components/views/HistoryView';
import { AddAssetModal } from '@/components/modals/AddAssetModal';

export default function HomePage() {
  const { view } = useWealth();

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
