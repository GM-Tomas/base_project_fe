'use client';

import React from 'react';

// While the data loads: the app's shape (the navigation, a header, the dashboard's cards) in placeholders,
// instead of a blank page.
export function AppSkeleton() {
  return (
    <div className="app-shell" aria-busy="true">
      <div className="skeleton-sidebar" aria-hidden>
        <div className="skeleton skeleton-brand" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton skeleton-nav" />
        ))}
      </div>
      <main className="app-main">
        <div className="app-header" aria-hidden>
          <div className="app-header-text">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
        <div className="app-content">
          <div className="sr-only" role="status">
            Loading your data…
          </div>
          <div className="dash-top" aria-hidden>
            <div className="skeleton skeleton-hero" />
            <div className="dash-metrics">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          </div>
          <div className="dash-bottom" aria-hidden style={{ marginTop: '18px' }}>
            <div className="skeleton skeleton-panel" />
            <div className="skeleton skeleton-panel" />
          </div>
        </div>
      </main>
    </div>
  );
}
