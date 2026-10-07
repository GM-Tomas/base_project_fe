'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useAuth } from '@/context/AuthContext';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { accountLabel } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { NAV_ITEMS } from './navItems';

export const Sidebar: React.FC = () => {
  const { view, setView } = useWealth();
  const { user } = useAuth();
  const t = useT();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const { name, initial } = accountLabel(user);


  return (
    <aside
      style={{
        width: '236px',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        borderRight: '1px solid var(--color-divider)',
        position: 'relative',
        zIndex: 2,
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 22px' }}>
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" stroke="var(--color-accent)" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="5.5" fill="var(--color-accent)" opacity="0.9" />
        </svg>
        <div style={{ fontWeight: 600, fontSize: '17px', letterSpacing: '0.02em', color: 'var(--color-text)' }}>BASE</div>
      </div>

      {/* Navigation Links */}
      <nav aria-label={t.nav.main} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              className="nav-link"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                background: isActive ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              {item.icon}
              <span>{t.nav[item.id]}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <button
        onClick={() => setIsProfileOpen(true)}
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 8px',
          background: 'transparent',
          border: 'none',
          borderTop: '1px solid var(--color-divider)',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--color-accent-800)',
            color: 'var(--color-accent-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            flex: 'none',
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--color-text)',
            }}
          >
            {name}
          </div>
        </div>
      </button>

      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </aside>
  );
};
