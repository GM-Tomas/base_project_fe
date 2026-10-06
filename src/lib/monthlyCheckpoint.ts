import type { Snapshot } from '@/types/wealth';

// The automatic monthly checkpoint (Settings → Preferences): saved when the app opens and the calendar month,
// in the user's time zone, has none yet. A browser claims the month before saving it, so tabs opened together
// don't each save one; the snapshots are read again right before, for another device that saved it meanwhile.

/** "2026-10": a date's calendar month, here. */
export function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Whether a checkpoint was taken in now's calendar month. */
export const hasCheckpointThisMonth = (snapshots: Snapshot[], now: Date) =>
  snapshots.some((s) => monthOf(new Date(s.capturedAt)) === monthOf(now));

const claimKey = (account: string) => `base.monthlyCheckpoint.${account}`;

/** Claims now's month for this browser: false if a tab already did (storage that can't be used claims nothing). */
export function claimMonth(account: string, now: Date): boolean {
  try {
    if (localStorage.getItem(claimKey(account)) === monthOf(now)) return false;
    localStorage.setItem(claimKey(account), monthOf(now));
  } catch {
    // Without storage, each tab checks the snapshots on its own.
  }
  return true;
}

/** Gives the month back (saving it failed): the next opening tries again. */
export function releaseMonth(account: string) {
  try {
    localStorage.removeItem(claimKey(account));
  } catch {
    // Nothing was kept.
  }
}
