'use client';

import React, { useId } from 'react';

export interface TabsProps<T extends string> {
  /** What the tabs switch between: the tab list's accessible name. */
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** The picked tab's content (only that one is rendered). */
  children: React.ReactNode;
}

// Tabs, as ARIA has them: the arrow keys, Home and End move between tabs (and show them); Tab goes into the
// panel. Only the picked panel is rendered.
export function Tabs<T extends string>({ label, tabs, value, onChange, children }: TabsProps<T>) {
  const base = useId();
  const tabId = (id: T) => `${base}-tab-${id}`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = tabs.findIndex((t) => t.id === value);
    const next: Record<string, number> = {
      ArrowRight: (at + 1) % tabs.length,
      ArrowLeft: (at - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    const to = tabs[next[e.key]].id;
    onChange(to);
    document.getElementById(tabId(to))?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label={label} className="tabs" onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={t.id === value}
            aria-controls={`${base}-panel`}
            tabIndex={t.id === value ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(value)} className="tab-panel">
        {children}
      </div>
    </>
  );
}
