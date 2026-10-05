'use client';

import React, { useId } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** What's being chosen: the group's accessible name (shown only to screen readers unless showLabel). */
  label: string;
  showLabel?: boolean;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** A line under it, about the option picked. */
  hint?: React.ReactNode;
}

// One choice among a few, all in sight: native radio buttons (arrow keys move between them) drawn as
// segments of one control.
export function SegmentedControl<T extends string>({ label, showLabel, options, value, onChange, hint }: SegmentedControlProps<T>) {
  const name = useId();
  const hintId = `${name}-hint`;
  return (
    <fieldset className="segmented-field" aria-describedby={hint ? hintId : undefined}>
      <legend className={showLabel ? 'segmented-legend' : 'sr-only'}>{label}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label key={option.value} className={option.value === value ? 'segment segment-active' : 'segment'}>
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && (
        <div id={hintId} className="field-hint">
          {hint}
        </div>
      )}
    </fieldset>
  );
}
