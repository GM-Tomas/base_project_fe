'use client';

import React, { useId } from 'react';
import { exactUsd, parseAmount, parseSignedAmount } from '@/lib/money';
import { useLanguage, useT } from '@/lib/i18n';

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
// when that isn't plain to see, or why it can't be. The form parses the same text again when it submits.
export function MoneyInput({ label, value, onChange, placeholder, autoFocus, disabled, inputRef, signed }: MoneyInputProps) {
  const id = useId();
  const t = useT();
  const zero = useLanguage() === 'es' ? '0,00' : '0.00';
  const hintId = `${id}-hint`;
  const parsed = value.trim() ? (signed ? parseSignedAmount(value) : parseAmount(value)) : null;
  // A whole number reads as typed: saying so is noise.
  const hint = parsed && (parsed.error ?? (/^\d+$/.test(value.trim()) ? null : t.amounts.read(exactUsd(parsed.value))));

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
        placeholder={placeholder ?? zero}
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
