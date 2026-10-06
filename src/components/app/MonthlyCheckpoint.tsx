'use client';

import { useEffect, useRef } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useAuth } from '@/context/AuthContext';
import { useUi } from '@/context/UiContext';
import { api } from '@/lib/api';
import { claimMonth, hasCheckpointThisMonth, releaseMonth } from '@/lib/monthlyCheckpoint';

// With the monthly checkpoint on, saves this month's when the app opens (or when it's turned on) and there's
// none yet, once: what's recorded, if anything, and the snapshots read again right before.
export function MonthlyCheckpoint() {
  const { preferences, holdings, debts, snapshots, takeSnapshot } = useWealth();
  const { user } = useAuth();
  const { toast } = useUi();
  const checked = useRef(false);
  const monthly = preferences.autoSnapshot === 'MONTHLY';

  useEffect(() => {
    if (!monthly || checked.current) return;
    checked.current = true;
    const now = new Date();
    if (holdings.length + debts.length === 0 || hasCheckpointThisMonth(snapshots, now)) return;
    const account = user?.id ?? 'demo';
    if (!claimMonth(account, now)) return;
    void (async () => {
      try {
        if (hasCheckpointThisMonth(await api.getSnapshots(), now)) return;
        await takeSnapshot();
        toast.success('Monthly checkpoint saved');
      } catch {
        releaseMonth(account);
        toast.error("Couldn't save this month's checkpoint. It'll be tried again next time.");
      }
    })();
    // What's on screen when it's turned on (or the app opens) is what's checked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly]);

  return null;
}
