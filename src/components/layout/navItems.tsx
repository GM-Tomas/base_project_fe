'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import type { ViewType } from '@/types/wealth';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

// The app's views, in the navigation's order, with their icons: the sidebar shows them all; on a phone, the
// bottom bar shows the everyday ones and More the rest.
export const NAV_ITEMS: NavItem[] = [
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
    id: 'debts',
    label: 'Debts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10H21" />
        <path d="M7 15H10" />
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
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={18} strokeWidth={1.6} aria-hidden />,
  },
];

export const navItem = (id: ViewType) => NAV_ITEMS.find((item) => item.id === id)!;
