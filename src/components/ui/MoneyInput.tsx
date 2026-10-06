'use client';

import React, { useId } from 'react';
import { formatUsd, parseAmount, parseSignedAmount } from '@/lib/money';

export interface MoneyInputProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Whether it can be below zero (a net worth). */
  signed?: boolean;
}

// A text field for an amount in any usual format (see parseAmount), showing how it was read ("= $1,234.56")
// or why it can't be. The form parses the same text again when it submits.
export function MoneyInput({ label, value, onChange, placeholder = '0.00', autoFocus, disabled, inputRef, signed }: MoneyInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const parsed = value.trim() ? (signed ? parseSignedAmount(value) : parseAmount(value)) : null;
  const hint = parsed && (parsed.error ?? `= ${formatUsd(parsed.value)}`);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        className="input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={parsed?.error ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && (
        <div id={hintId} className={parsed.error ? 'field-error' : 'field-hint'}>
          {hint}
        </div>
      )}
    </div>
  );
}
