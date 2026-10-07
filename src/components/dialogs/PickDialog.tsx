'use client';

import React, { useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useT } from '@/lib/i18n';

export interface PickDialogProps {
  title: string;
  /** What's being picked: the field's label. */
  label: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  onClose: () => void;
}

// One step before a dialog that's about something in particular (a gain on which asset? a payment on which
// debt?): pick it, then Continue.
export function PickDialog({ title, label, options, onPick, onClose }: PickDialogProps) {
  const id = useId();
  const [value, setValue] = useState(options[0]?.value ?? '');
  const t = useT().common;
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          onPick(value);
        }}
      >
        <div className="field">
          <label htmlFor={id}>{label}</label>
          <select id={id} className="input" value={value} onChange={(e) => setValue(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.continue}
          </button>
        </div>
      </form>
    </Modal>
  );
}
