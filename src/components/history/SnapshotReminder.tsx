'use client';

import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { errorMessage } from '@/lib/apiError';
import { today } from '@/lib/movements';
import { snapshotReminder } from '@/lib/periods';

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
// it (unless the page has its own button for that); Dismiss hides it until tomorrow.
export function SnapshotReminder({ withSave = true }: { withSave?: boolean }) {
  const { snapshots, holdings, takeSnapshot } = useWealth();
  const { toast } = useUi();
  const [dismissed, setDismissed] = useState(dismissedToday);
  const [saving, setSaving] = useState(false);
  const reminder = snapshotReminder(snapshots, holdings.length, new Date());
  if (!reminder || dismissed) return null;

  const save = async () => {
    setSaving(true);
    try {
      await takeSnapshot();
      toast.success('Snapshot saved');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save a snapshot right now'));
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
      <Camera size={16} aria-hidden />
      <span className="reminder-text">
        {reminder.days === null
          ? 'Save your first checkpoint to start your history.'
          : `It's been ${reminder.days} days since your last checkpoint.`}
      </span>
      {withSave && (
        <button type="button" className="btn btn-secondary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save a snapshot'}
        </button>
      )}
      <button type="button" className="btn btn-ghost" title="Hide it until tomorrow" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
