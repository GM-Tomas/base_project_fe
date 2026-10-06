'use client';

import React, { useId } from 'react';
import { useWealth } from '@/context/WealthContext';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HISTORY_PERIODS, START_VIEWS } from '@/lib/preferences';
import { PERIOD_PRESETS } from '@/lib/periods';
import type { AutoSnapshot, HistoryPeriodPreset, ViewType } from '@/types/wealth';

export const VIEW_LABEL: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  platforms: 'Platforms',
  assets: 'Assets',
  debts: 'Debts',
  estimate: 'Estimate',
  history: 'History',
  settings: 'Settings',
};

const AUTO_OPTIONS: { value: AutoSnapshot; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const periodLabel = (p: HistoryPeriodPreset) => PERIOD_PRESETS.find((o) => o.value === p)!.label;

// How the app opens, for every device: a checkpoint each month on its own, the view to start on and the
// period History starts with. Each change is saved at once.
export function PreferencesSection() {
  const { preferences, setGeneralPrefs } = useWealth();
  const viewId = useId();
  const periodId = useId();

  return (
    <section className="card elev-sm" aria-labelledby="settings-preferences">
      <div className="settings-head">
        <div>
          <h2 id="settings-preferences" className="settings-title">
            Preferences
          </h2>
          <p className="text-muted settings-sub">How BASE opens, on every device you sign in on.</p>
        </div>
      </div>
      <div className="prefs-grid">
        <SegmentedControl
          label="Automatic checkpoint"
          showLabel
          options={AUTO_OPTIONS}
          value={preferences.autoSnapshot}
          onChange={(autoSnapshot) => setGeneralPrefs({ autoSnapshot })}
          hint={
            preferences.autoSnapshot === 'MONTHLY'
              ? 'One is saved when you open BASE and the month has none yet.'
              : 'Checkpoints are saved only when you ask.'
          }
        />
        <div className="field">
          <label htmlFor={viewId}>Start on</label>
          <select
            id={viewId}
            className="input"
            value={preferences.defaultView}
            onChange={(e) => setGeneralPrefs({ defaultView: e.target.value as ViewType })}
          >
            {START_VIEWS.map((v) => (
              <option key={v} value={v}>
                {VIEW_LABEL[v]}
              </option>
            ))}
          </select>
          <div className="field-hint">The view BASE opens on.</div>
        </div>
        <div className="field">
          <label htmlFor={periodId}>History period</label>
          <select
            id={periodId}
            className="input"
            value={preferences.historyPeriod}
            onChange={(e) => setGeneralPrefs({ historyPeriod: e.target.value as HistoryPeriodPreset })}
          >
            {HISTORY_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p === 'ALL' ? 'All time' : p === 'YTD' ? 'This year (YTD)' : periodLabel(p)}
              </option>
            ))}
          </select>
          <div className="field-hint">The period History opens with.</div>
        </div>
      </div>
    </section>
  );
}
