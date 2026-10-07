'use client';

import React, { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { isHexColor, PALETTE } from '@/lib/customization';
import { useT } from '@/lib/i18n';

export interface ColorPickerProps {
  label: string;
  /** #rrggbb, or null for the default. */
  value: string | null;
  onChange: (color: string | null) => void;
  /** What the default looks like (a CSS color), shown on its swatch. */
  defaultColor: string;
}

// A color among the design system's twelve, the default, or one's own in hex. The swatches are radio
// buttons (arrow keys move between them); the hex field takes any #rrggbb.
export function ColorPicker({ label, value, onChange, defaultColor }: ColorPickerProps) {
  const name = useId();
  const hexId = useId();
  const t = useT().colors;
  const own = value !== null && !PALETTE.some((c) => c.hex === value.toLowerCase());
  const [hex, setHex] = useState(own ? value! : '');
  const hexError = hex.trim() && !isHexColor(normalizeHex(hex)) ? t.hexProblem : '';

  const swatch = (key: string, title: string, color: string, checked: boolean, pick: () => void) => (
    <label key={key} className={checked ? 'swatch swatch-checked' : 'swatch'} title={title} style={{ '--swatch': color } as React.CSSProperties}>
      <input type="radio" className="sr-only" name={name} checked={checked} onChange={pick} aria-label={title} />
      {checked && <Check size={13} strokeWidth={3} aria-hidden />}
    </label>
  );

  return (
    <fieldset className="color-picker">
      <legend className="segmented-legend">
        {label} <span className="color-picked">· {pickedName(value, t)}</span>
      </legend>
      <div className="swatches">
        {swatch('default', t.default, defaultColor, value === null, () => {
          setHex('');
          onChange(null);
        })}
        {PALETTE.map((c) =>
          swatch(c.hex, t.names[c.name], c.hex, value?.toLowerCase() === c.hex, () => {
            setHex('');
            onChange(c.hex);
          }),
        )}
      </div>
      <div className="color-own">
        <label htmlFor={hexId}>{t.own}</label>
        <input
          id={hexId}
          className="input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="#1a2b3c"
          maxLength={7}
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            const typed = normalizeHex(e.target.value);
            if (isHexColor(typed)) onChange(typed.toLowerCase());
          }}
          aria-invalid={hexError ? true : undefined}
        />
        <input
          type="color"
          className="color-native"
          aria-label={t.pick}
          value={value ?? '#00c0c2'}
          onChange={(e) => {
            setHex(e.target.value);
            onChange(e.target.value.toLowerCase());
          }}
        />
      </div>
      {hexError && <div className="field-error">{hexError}</div>}
    </fieldset>
  );
}

// What's picked, in words: Default, a palette color's name, or the hex.
const pickedName = (value: string | null, t: ReturnType<typeof useT>['colors']) => {
  if (value === null) return t.default;
  const named = PALETTE.find((c) => c.hex === value.toLowerCase());
  return named ? t.names[named.name] : value.toLowerCase();
};

// "1a2b3c" and " #1A2B3C " are a color too.
const normalizeHex = (text: string) => {
  const t = text.trim();
  return t.startsWith('#') ? t : `#${t}`;
};
