'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { FormError } from '@/components/ui/FormError';
import { IconButton } from '@/components/ui/IconButton';
import { exactUsd, parseAmount } from '@/lib/money';
import { DEFAULT_ESTIMATE, MAX_MILESTONE_USD, MAX_MILESTONES } from '@/lib/preferences';
import { useT } from '@/lib/i18n';

const textsOf = (amounts: number[]) => amounts.map((a) => String(a));

// The amounts Estimate says when the net worth reaches: up to five, in any order (they're kept sorted).
export function MilestonesDialog({ onClose }: { onClose: () => void }) {
  const { estimatePrefs, setEstimatePrefs } = useWealth();
  const [texts, setTexts] = useState(() => textsOf(estimatePrefs.milestonesUsd));
  const [error, setError] = useState('');
  const tAll = useT();
  const t = tAll.milestones;

  const set = (i: number, text: string) => setTexts((current) => current.map((t, j) => (j === i ? text : t)));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = texts.filter((t) => t.trim());
    const amounts: number[] = [];
    for (const text of filled) {
      const parsed = parseAmount(text);
      if (parsed.error !== undefined) {
        setError(t.notAnAmount(text, parsed.error));
        return;
      }
      if (parsed.value <= 0 || parsed.value > MAX_MILESTONE_USD) {
        setError(t.range(exactUsd(MAX_MILESTONE_USD)));
        return;
      }
      amounts.push(parsed.value);
    }
    const unique = [...new Set(amounts)].sort((a, b) => a - b);
    setEstimatePrefs((prefs) => ({ ...prefs, milestonesUsd: unique }));
    onClose();
  };

  return (
    <Modal title={t.title} onClose={onClose}>
      <div className="dialog-subtitle">{t.subtitle(MAX_MILESTONES)}</div>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={save} noValidate className="dialog-form">
        {texts.map((text, i) => (
          <div key={i} className="milestone-row">
            <MoneyInput label={t.milestone(i + 1)} value={text} onChange={(typed) => set(i, typed)} placeholder={t.placeholder} />
            <IconButton label={t.remove(i + 1)} onClick={() => setTexts((current) => current.filter((_, j) => j !== i))}>
              <X size={15} aria-hidden />
            </IconButton>
          </div>
        ))}
        {texts.length === 0 && <div className="text-muted">{t.none}</div>}
        <div className="milestone-tools">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={texts.length >= MAX_MILESTONES}
            onClick={() => setTexts((current) => [...current, ''])}
          >
            {t.add}
          </button>
          <button type="button" className="link-btn link-accent" onClick={() => setTexts(textsOf(DEFAULT_ESTIMATE.milestonesUsd))}>
            {t.reset}
          </button>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
