'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useAuth } from '@/context/AuthContext';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { ViewType } from '@/types/wealth';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const { view, setView, platforms } = useWealth();
  const { user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Account';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = name.charAt(0).toUpperCase();

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" opacity="0.55" />
          <rect x="3" y="13" width="8" height="8" rx="2" opacity="0.55" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
      ),
    },
    {
      id: 'platforms',
      label: 'Platforms',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9L12 3L21 9" />
          <path d="M5 9V19H19V9" />
          <path d="M9 19V13H15V19" />
        </svg>
      ),
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: (
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
          <path d="M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z" />
        </svg>
      ),
    },
    {
      id: 'estimate',
      label: 'Estimate',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17L9 11L13 15L21 6" />
          <path d="M15 6H21V12" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12L15 14" />
        </svg>
      ),
    },
  ];

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
        <div>
          <div style={{ fontWeight: 600, fontSize: '17px', letterSpacing: '0.02em', color: 'var(--color-text)' }}>
            BASE
          </div>
          <div
            style={{
              fontSize: '9.5px',
              letterSpacing: '0.08em',
              color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
              textTransform: 'uppercase',
              marginTop: '1px',
            }}
          >
            Your money, together
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
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
                border: isActive
                  ? '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)'
                  : '1px solid transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
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
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: '32px', height: '32px', borderRadius: '50%', flex: 'none' }}
          />
        ) : (
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
        )}
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
          <div
            style={{
              fontSize: '11.5px',
              color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
            }}
          >
            {platforms.length} accounts linked
          </div>
        </div>
      </button>

      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </aside>
  );
};
