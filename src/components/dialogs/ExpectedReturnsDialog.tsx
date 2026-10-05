'use client';

import React, { useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import { PercentInput } from '@/components/ui/PercentInput';
import { errorMessage } from '@/lib/apiError';
import type { ExpectedReturnItem } from '@/lib/api';
import { formatCurrency } from '@/lib/calculations';
import { expectedReturnOf, formatReturn, parsePercent } from '@/lib/returns';
import type { Holding } from '@/types/wealth';

const textOf = (pct: number | null) => (pct === null ? '' : String(pct));

// Every holding's expected yearly return at once, grouped by class (largest first), with a way to give a
// whole class the same one. What the portfolio would earn follows as they're typed; Save sends what changed,
// all or nothing.
export function ExpectedReturnsDialog({ onClose }: { onClose: () => void }) {
  const { holdings, setExpectedReturns } = useWealth();
  const { toast } = useUi();
  const [typed, setTyped] = useState<Record<string, string>>(() =>
    Object.fromEntries(holdings.map((h) => [h.id, textOf(h.expectedReturnPct)])),
  );
  const [classTyped, setClassTyped] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const classes = new Map<string, Holding[]>();
  for (const h of [...holdings].sort((a, b) => b.valueUsd - a.valueUsd || a.name.localeCompare(b.name))) {
    classes.set(h.assetClass, [...(classes.get(h.assetClass) ?? []), h]);
  }
  const groups = [...classes].sort(
    ([, a], [, b]) => b.reduce((sum, h) => sum + h.valueUsd, 0) - a.reduce((sum, h) => sum + h.valueUsd, 0),
  );

  const parsed = (id: string) => parsePercent(typed[id] ?? '');
  const invalid = holdings.filter((h) => parsed(h.id).error !== undefined);
  const preview = expectedReturnOf(
    holdings.map((h) => ({ valueUsd: h.valueUsd, effectiveReturnPct: parsed(h.id).value ?? null })),
  );
  const changes: ExpectedReturnItem[] = holdings
    .filter((h) => parsed(h.id).error === undefined && (parsed(h.id).value ?? null) !== h.expectedReturnPct)
    .map((h) => ({ holdingId: h.id, expectedReturnPct: parsed(h.id).value ?? null }));

  const applyToClass = (assetClass: string, members: Holding[]) => {
    const text = classTyped[assetClass] ?? '';
    if (parsePercent(text).error !== undefined) return;
    setTyped((current) => ({ ...current, ...Object.fromEntries(members.map((h) => [h.id, text.trim()])) }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid.length) {
      setError(`Check the return of ${invalid.map((h) => h.name).join(', ')}`);
      return;
    }
    if (changes.length === 0) {
      onClose();
      return;
    }
    setError('');
    setSaving(true);
    try {
      await setExpectedReturns(changes);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the returns. Please try again."));
      setSaving(false);
      return;
    }
    toast.success('Expected returns saved');
    onClose();
  };

  return (
    <Modal title="Set expected returns" onClose={onClose} busy={saving} className="dialog-wide">
      <div className="dialog-subtitle">
        Roughly how much each one grows in a year. Leave empty if you don&apos;t know: it counts as 0%.
      </div>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={save} noValidate className="dialog-form">
        <div className="returns-groups">
          {groups.map(([assetClass, members]) => {
            const classText = classTyped[assetClass] ?? '';
            const classParsed = parsePercent(classText);
            return (
              <fieldset key={assetClass} className="form-group returns-group">
                <legend>{assetClass}</legend>
                <div className="returns-apply">
                  <PercentInput
                    label={`Return for all of ${assetClass}`}
                    hideLabel
                    placeholder="Same for all"
                    value={classText}
                    onChange={(text) => setClassTyped((current) => ({ ...current, [assetClass]: text }))}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!classText.trim() || classParsed.error !== undefined}
                    onClick={() => applyToClass(assetClass, members)}
                    aria-label={`Apply to ${assetClass}`}
                  >
                    Apply to class
                  </button>
                </div>
                {members.map((h) => (
                  <div key={h.id} className="returns-row">
                    <div className="returns-name">
                      <div>{h.name}</div>
                      <div className="text-muted debt-sub">
                        {h.platform} · {formatCurrency(h.valueUsd)}
                      </div>
                    </div>
                    <PercentInput
                      label={`Expected return of ${h.name}`}
                      hideLabel
                      placeholder="—"
                      value={typed[h.id] ?? ''}
                      onChange={(text) => setTyped((current) => ({ ...current, [h.id]: text }))}
                      className="returns-input"
                    />
                  </div>
                ))}
              </fieldset>
            );
          })}
        </div>

        <div className="preview" aria-live="polite">
          {preview.weightedPct === null ? (
            'Add assets to see what your portfolio would earn.'
          ) : (
            <>
              <div>
                Your portfolio: {formatReturn(preview.weightedPct)} a year · ≈ {formatCurrency(preview.annualUsd)}
              </div>
              <div className="text-muted">
                {preview.coveragePct === 100 ? 'Every asset has a return' : `Based on ${formatReturn(preview.coveragePct)} of your portfolio`}
              </div>
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : changes.length ? `Save ${changes.length} ${changes.length === 1 ? 'return' : 'returns'}` : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
