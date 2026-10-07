'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { usesMockData } from '@/lib/dataSource';
import { setAmountsHidden, useAmountsHidden } from '@/lib/privacy';
import { useT } from '@/lib/i18n';
import { NewMenu } from './NewMenu';

// The view's title, the privacy switch (H) and New ▾.
export const Header: React.FC = () => {
  const { view } = useWealth();
  const hidden = useAmountsHidden();
  const t = useT();
  const privacyLabel = hidden ? t.header.showAmounts : t.header.hideAmounts;

  return (
    <header className="app-header">
      <div className="app-header-text">
        <div className="app-title-row">
          <h1 className="app-title">{t.nav[view]}</h1>
          {usesMockData && (
            <span
              className="tag tag-neutral"
              title={t.header.demoTitle}
            >
              {t.header.demoData}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        className="icon-btn header-icon"
        aria-label={privacyLabel}
        title={t.header.withKey(privacyLabel, 'H')}
        onClick={() => setAmountsHidden(!hidden)}
      >
        {hidden ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
      <NewMenu />
    </header>
  );
};
