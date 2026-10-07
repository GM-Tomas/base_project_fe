'use client';

import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { errorMessage } from '@/lib/apiError';
import { today } from '@/lib/movements';
import { snapshotReminder } from '@/lib/periods';
import { useT } from '@/lib/i18n';

const DISMISSED_KEY = 'base.snapshotReminder.dismissedOn';

// Dismissed until tomorrow, in this browser (storage that's blocked or full only means it shows again).
function dismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === today();
  } catch {
    return false;
  }
}

// A nudge to save a checkpoint when the last one is over a month old (or there's none yet): one click saves
// it; Dismiss hides it until tomorrow.
export function SnapshotReminder() {
  const { snapshots, holdings, takeSnapshot } = useWealth();
  const { toast } = useUi();
  const tAll = useT();
  const t = tAll.snapshot;
  const [dismissed, setDismissed] = useState(dismissedToday);
  const [saving, setSaving] = useState(false);
  const reminder = snapshotReminder(snapshots, holdings.length, new Date());
  if (!reminder || dismissed) return null;

  const save = async () => {
    setSaving(true);
    try {
      await takeSnapshot();
      toast.success(t.saved);
    } catch (e) {
      toast.error(errorMessage(e, t.failed));
    } finally {
      setSaving(false);
    }
  };
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, today());
    } catch {
      // Hidden for this visit only.
    }
    setDismissed(true);
  };

  return (
    <div className="reminder" role="status">
      <Camera size={15} aria-hidden />
      <span>
        {reminder.days === null ? t.first : t.daysSince(reminder.days)}
      </span>
      <button type="button" className="link-btn link-accent" onClick={save} disabled={saving}>
        {saving ? tAll.common.saving : t.save}
      </button>
      <button type="button" className="link-btn" title={t.dismissTitle} onClick={dismiss}>
        {tAll.common.dismiss}
      </button>
    </div>
  );
}
