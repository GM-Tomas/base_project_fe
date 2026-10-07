'use client';

import React, { useId, useState } from 'react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import { Combobox } from '@/components/ui/Combobox';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { errorMessage } from '@/lib/apiError';
import type { PlatformPatch } from '@/lib/api';
import { platformColor } from '@/lib/constants';
import { contrastRatio, MAX_PLATFORM_NAME, MAX_PLATFORM_TYPE, normalizeAvatar, validAvatar } from '@/lib/customization';
import { messages, useT } from '@/lib/i18n';
import { initialOf } from '@/lib/initial';
import { normalizeLabel, platformKey } from '@/lib/labels';
import type { Platform } from '@/types/wealth';

export interface PlatformCustomizeDialogProps {
  platform: Platform;
  onClose: () => void;
}

/** "Merge Binance US into Binance? Its 2 assets move there." */
export const platformMergeMessage = (from: Platform, into: Platform) =>
  messages().platformForm.merge(from.name, into.name, from.holdingsCount);

// A design token's value (the default colors are `var(--…)`), to measure it.
const resolveColor = (color: string) => {
  const token = /^var\((--[\w-]+)\)$/.exec(color);
  return token ? getComputedStyle(document.documentElement).getPropertyValue(token[1]).trim() : color;
};

// How a platform looks (its thumbnail's letters or emoji, their color and the one behind them), its type and
// its name, with a live preview. A name another platform has (case aside) merges them, once confirmed.
export function PlatformCustomizeDialog({ platform, onClose }: PlatformCustomizeDialogProps) {
  const { platforms, updatePlatform } = useWealth();
  const { toast, openDialog } = useUi();
  const tAll = useT();
  const t = tAll.platformForm;
  const ids = { avatar: useId(), name: useId() };

  const [avatar, setAvatar] = useState(platform.avatarText ?? '');
  const [color, setColor] = useState<string | null>(platform.color);
  const [textColor, setTextColor] = useState<string | null>(platform.textColor);
  const [type, setType] = useState(platform.type);
  const [name, setName] = useState(platform.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const typedName = normalizeLabel(name);
  const typedAvatar = normalizeAvatar(avatar);
  const avatarError = typedAvatar && !validAvatar(typedAvatar) ? t.avatarProblem : '';
  const typedType = normalizeLabel(type);
  // Another of the user's platforms with that name, case aside: saving merges into it.
  const other = platforms.find((p) => p.id !== platform.id && platformKey(p.name) === platformKey(typedName));
  const previewName = typedName || platform.name;
  const background = color ?? platformColor(platform.name);
  // Letters of their own sit on a solid background: warn when the two are hard to tell apart (WCAG's 3:1
  // for large text; the thumbnail's letters are big and bold).
  const ratio = textColor ? contrastRatio(textColor, resolveColor(background)) : null;
  const lowContrast = ratio !== null && ratio < 3;

  const patch = (): PlatformPatch => {
    const p: PlatformPatch = {};
    if (typedName !== platform.name) p.name = typedName;
    if (typedType !== platform.type) p.type = typedType || null;
    if ((typedAvatar || null) !== platform.avatarText) p.avatarText = typedAvatar || null;
    if (color !== platform.color) p.color = color;
    if (textColor !== platform.textColor) p.textColor = textColor;
    return p;
  };
  const unchanged = Object.keys(patch()).length === 0;

  const problem = () =>
    !typedName
      ? t.enterName
      : [...typedName].length > MAX_PLATFORM_NAME
        ? t.nameTooLong(MAX_PLATFORM_NAME)
        : avatarError
          ? t.thumbnailProblem(avatarError)
          : [...typedType].length > MAX_PLATFORM_TYPE
            ? t.typeTooLong(MAX_PLATFORM_TYPE)
            : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const wrong = problem();
    if (wrong) {
      setError(wrong);
      return;
    }
    if (other) {
      openDialog((close) => (
        <ConfirmDialog
          title={tAll.common.mergeInto(other.name)}
          message={platformMergeMessage(platform, other)}
          confirmLabel={tAll.common.merge}
          busyLabel={tAll.common.merging}
          tone="primary"
          failureMessage={t.mergeFailed}
          onConfirm={async () => {
            await updatePlatform(platform.id, { name: other.name, mergeIfExists: true });
            toast.success(tAll.common.mergedInto(other.name));
            onClose();
          }}
          onClose={close}
        />
      ));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updatePlatform(platform.id, patch());
    } catch (err) {
      setError(errorMessage(err, t.saveFailed));
      setSaving(false);
      return;
    }
    toast.success(tAll.common.changesSaved);
    onClose();
  };

  const resetLook = () => {
    setAvatar('');
    setColor(null);
    setTextColor(null);
  };

  return (
    <Modal title={tAll.common.customize(platform.name)} onClose={onClose} busy={saving}>
      {error && <FormError>{error}</FormError>}
      <form onSubmit={save} noValidate className="dialog-form">
        <div className="platform-preview" aria-live="polite">
          <PlatformAvatar text={typedAvatar && !avatarError ? typedAvatar : initialOf(previewName)} color={background} textColor={textColor} size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="platform-preview-name">{previewName}</div>
            <div className="text-muted">
              {typedType && typedType !== 'Other' ? typedType : t.noType} · {tAll.common.assets(platform.holdingsCount)}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.avatar}>{t.thumbnail}</label>
          <input
            id={ids.avatar}
            className="input"
            type="text"
            autoComplete="off"
            placeholder={initialOf(previewName)}
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            aria-invalid={avatarError ? true : undefined}
            aria-describedby={`${ids.avatar}-hint`}
          />
          <div id={`${ids.avatar}-hint`} className={avatarError ? 'field-error' : 'field-hint'}>
            {avatarError || t.thumbnailHint}
          </div>
        </div>

        <ColorPicker label={t.background} value={color} onChange={setColor} defaultColor={platformColor(platform.name)} />

        <ColorPicker label={t.text} value={textColor} onChange={setTextColor} defaultColor={background} />
        {lowContrast && <div className="field-hint field-warning">{t.lowContrast}</div>}

        <Combobox label={t.type} value={type} onChange={setType} options={t.types} placeholder={t.noType} />

        <div className="field">
          <label htmlFor={ids.name}>{tAll.common.name}</label>
          <input
            id={ids.name}
            className="input"
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={`${ids.name}-hint`}
          />
          <div id={`${ids.name}-hint`} className="field-hint">
            {other
              ? t.existsHint(other.name, platform.name)
              : typedName !== platform.name && typedName
                ? t.renames(platform.holdingsCount)
                : t.renaming(platform.holdingsCount)}
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost dialog-actions-start" onClick={resetLook} disabled={saving || (!avatar && color === null && textColor === null)}>
            {t.reset}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {tAll.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || (unchanged && !other)}>
            {saving ? tAll.common.saving : other ? tAll.common.mergeEllipsis : tAll.common.saveChanges}
          </button>
        </div>
      </form>
    </Modal>
  );
}
