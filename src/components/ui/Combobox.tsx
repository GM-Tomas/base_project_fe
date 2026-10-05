'use client';

import React, { useId } from 'react';

export interface ComboboxProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** What to suggest while typing. */
  options: string[];
  /** A line under the field: whether what's typed is new, or which existing one it matches. */
  hint?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}

// One field to pick an existing value or type a new one: a text input with the existing ones as native
// suggestions (<datalist>), accessible and without a dependency.
export function Combobox({ label, value, onChange, options, hint, placeholder, autoFocus }: ComboboxProps) {
  const id = useId();
  const listId = `${id}-options`;
  const hintId = `${id}-hint`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="text"
        list={listId}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-describedby={hint ? hintId : undefined}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {hint && (
        <div id={hintId} className="field-hint">
          {hint}
        </div>
      )}
    </div>
  );
}
