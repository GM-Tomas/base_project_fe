'use client';

import React, { useId } from 'react';
import { today } from '@/lib/movements';
import { useT } from '@/lib/i18n';

export interface DateInputProps {
  label?: string;
  /** YYYY-MM-DD. */
  value: string;
  onChange: (date: string) => void;
}

// The day something happened: the browser's date picker, up to today in the user's time zone.
export function DateInput({ label, value, onChange }: DateInputProps) {
  const id = useId();
  const t = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label ?? t.common.date}</label>
      <input
        id={id}
        className="input"
        type="date"
        min="1970-01-01"
        max={today()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
