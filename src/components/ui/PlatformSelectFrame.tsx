'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { PlatformAvatar } from './PlatformAvatar';

// A platform picker (a native <select>) with the picked platform's thumbnail inside it, at its start:
// options can't show one, the field can.
export function PlatformSelectFrame({ platform, children }: { platform: string | null; children: React.ReactNode }) {
  const { platforms, platformLook } = useWealth();
  const known = platform !== null && platforms.some((p) => p.name === platform);
  return (
    <div className={known ? 'select-avatar select-avatar-on' : 'select-avatar'}>
      {known && <PlatformAvatar {...platformLook(platform)} size={20} />}
      {children}
    </div>
  );
}
