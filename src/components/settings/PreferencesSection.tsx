'use client';

import React, { useId } from 'react';
import { useWealth } from '@/context/WealthContext';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HISTORY_PERIODS, START_VIEWS } from '@/lib/preferences';
import { LANGUAGE_SETTINGS, languageSetting, useLanguage, useT, type LanguageSetting } from '@/lib/i18n';
import type { AutoSnapshot, HistoryPeriodPreset, ViewType } from '@/types/wealth';

const AUTO: AutoSnapshot[] = ['OFF', 'MONTHLY'];

// How the app opens, for every device: its language, a checkpoint each month on its own, the view to start
// on and the period History starts with. Each change is saved at once.
export function PreferencesSection() {
  const { preferences, setGeneralPrefs } = useWealth();
  const tAll = useT();
  const t = tAll.settings;
  const viewId = useId();
  const periodId = useId();
  const languageId = useId();
  // The account's language; when it has none (automatic), what this device was set to (at sign-in, say).
  useLanguage();
  const shownLanguage = preferences.language !== 'auto' ? preferences.language : languageSetting();

  return (
    <section className="card elev-sm" aria-labelledby="settings-preferences">
      <div className="settings-head">
        <div>
          <h2 id="settings-preferences" className="sr-only">
            {t.preferencesHeading}
          </h2>
          <p className="text-muted settings-sub">{t.preferencesSub}</p>
        </div>
      </div>
      <div className="prefs-grid">
        <div className="field">
          <label htmlFor={languageId}>{t.language}</label>
          <select
            id={languageId}
            className="input"
            value={shownLanguage}
            onChange={(e) => setGeneralPrefs({ language: e.target.value as LanguageSetting })}
          >
            {LANGUAGE_SETTINGS.map((l) => (
              <option key={l} value={l}>
                {t.languages[l]}
              </option>
            ))}
          </select>
          <div className="field-hint">{t.languageHint}</div>
        </div>
        <SegmentedControl
          label={t.autoCheckpoint}
          showLabel
          options={AUTO.map((a) => ({ value: a, label: t.auto[a] }))}
          value={preferences.autoSnapshot}
          onChange={(autoSnapshot) => setGeneralPrefs({ autoSnapshot })}
          hint={preferences.autoSnapshot === 'MONTHLY' ? t.monthlyHint : t.offHint}
        />
        <div className="field">
          <label htmlFor={viewId}>{t.startOn}</label>
          <select
            id={viewId}
            className="input"
            value={preferences.defaultView}
            onChange={(e) => setGeneralPrefs({ defaultView: e.target.value as ViewType })}
          >
            {START_VIEWS.map((v) => (
              <option key={v} value={v}>
                {tAll.nav[v]}
              </option>
            ))}
          </select>
          <div className="field-hint">{t.startOnHint}</div>
        </div>
        <div className="field">
          <label htmlFor={periodId}>{t.historyPeriod}</label>
          <select
            id={periodId}
            className="input"
            value={preferences.historyPeriod}
            onChange={(e) => setGeneralPrefs({ historyPeriod: e.target.value as HistoryPeriodPreset })}
          >
            {HISTORY_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p === 'ALL' ? t.allTime : p === 'YTD' ? t.thisYear : tAll.history.presets[p]}
              </option>
            ))}
          </select>
          <div className="field-hint">{t.historyPeriodHint}</div>
        </div>
      </div>
    </section>
  );
}
