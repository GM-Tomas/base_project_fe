'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { usesMockData } from '@/lib/dataSource';
import { setAmountsHidden, useAmountsHidden } from '@/lib/privacy';
import { NewMenu } from './NewMenu';
import type { ViewType } from '@/types/wealth';

const VIEW_TITLES: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  platforms: 'Platforms',
  assets: 'Assets',
  debts: 'Debts',
  estimate: 'Estimate',
  history: 'History',
  settings: 'Settings',
};

const VIEW_SUBTITLES: Record<ViewType, string> = {
  dashboard: "Here's your full financial picture, today.",
  platforms: "Every account you've linked, side by side.",
  assets: 'Every holding you own, in one table.',
  debts: "What you owe, what it costs and when it's paid off.",
  estimate: "See where you're headed — move the sliders and watch it change.",
  history: 'How your net worth has moved, checkpoint by checkpoint.',
  settings: 'How BASE opens, your classes and platforms, and your data.',
};

// The view's title, the privacy switch (H) and New ▾.
export const Header: React.FC = () => {
  const { view } = useWealth();
  const hidden = useAmountsHidden();
  const privacyLabel = hidden ? 'Show amounts' : 'Hide amounts';

  return (
    <header className="app-header">
      <div className="app-header-text">
        <div className="app-title-row">
          <h1 className="app-title">{VIEW_TITLES[view]}</h1>
          {usesMockData && (
            <span
              className="tag tag-accent-2"
              title="A preview: made-up data kept in this tab. Nothing is saved, nothing reaches production."
            >
              Demo data
            </span>
          )}
        </div>
        <div className="app-subtitle">{VIEW_SUBTITLES[view]}</div>
      </div>

      <button
        type="button"
        className="icon-btn header-icon"
        aria-label={privacyLabel}
        title={`${privacyLabel} (H)`}
        onClick={() => setAmountsHidden(!hidden)}
      >
        {hidden ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
      <NewMenu />
    </header>
  );
};
