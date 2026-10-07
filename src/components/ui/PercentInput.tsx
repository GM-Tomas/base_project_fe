'use client';

import React, { useId } from 'react';
import { formatReturn, parsePercent } from '@/lib/returns';
import { useT } from '@/lib/i18n';

export interface PercentInputProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** A line under it while what's typed is fine (or empty). */
  hint?: React.ReactNode;
  min?: number;
  max?: number;
  /** Label shown only to screen readers (in a table row, say). */
  hideLabel?: boolean;
  className?: string;
}

// A text field for a percentage typed either way ("7,5" or "7.5"), showing how it was read ("= 7.5% a
// year") or why it can't be. The form parses the same text again when it saves.
export function PercentInput({ label, value, onChange, placeholder, hint, min, max, hideLabel, className }: PercentInputProps) {
  const id = useId();
  const t = useT();
  const hintId = `${id}-hint`;
  const parsed = parsePercent(value, { min, max });
  const message = parsed.error ?? (parsed.value !== null && !hideLabel ? t.percent.read(formatReturn(parsed.value, 2)) : hint);

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      <div className="percent-input">
        <input
          id={id}
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder ?? t.common.percentPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={parsed.error ? true : undefined}
          aria-describedby={message ? hintId : undefined}
        />
        <span className="percent-suffix" aria-hidden>
          %
        </span>
      </div>
      {message && (
        <div id={hintId} className={parsed.error ? 'field-error' : 'field-hint'}>
          {message}
        </div>
      )}
    </div>
  );
}
