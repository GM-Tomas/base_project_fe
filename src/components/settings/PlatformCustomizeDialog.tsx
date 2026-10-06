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
import { MAX_PLATFORM_NAME, MAX_PLATFORM_TYPE, normalizeAvatar, PLATFORM_TYPES, validAvatar } from '@/lib/customization';
import { initialOf } from '@/lib/initial';
import { normalizeLabel, platformKey } from '@/lib/labels';
import type { Platform } from '@/types/wealth';

export interface PlatformCustomizeDialogProps {
  platform: Platform;
  onClose: () => void;
}

const assets = (n: number) => `${n} ${n === 1 ? 'asset' : 'assets'}`;

/** "Merge Binance US into Binance? Its 2 assets move there." */
export const platformMergeMessage = (from: Platform, into: Platform) =>
  `Merge ${from.name} into ${into.name}? ${from.holdingsCount === 1 ? 'Its asset moves' : `Its ${assets(from.holdingsCount)} move`} there, and ${into.name} keeps its own look.`;

// How a platform looks (its thumbnail's letters or emoji, its color), its type and its name, with a live
// preview. A name another platform has (case aside) merges them, once confirmed.
export function PlatformCustomizeDialog({ platform, onClose }: PlatformCustomizeDialogProps) {
  const { platforms, updatePlatform } = useWealth();
  const { toast, openDialog } = useUi();
  const ids = { avatar: useId(), name: useId() };

  const [avatar, setAvatar] = useState(platform.avatarText ?? '');
  const [color, setColor] = useState<string | null>(platform.color);
  const [type, setType] = useState(platform.type);
  const [name, setName] = useState(platform.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const typedName = normalizeLabel(name);
  const typedAvatar = normalizeAvatar(avatar);
  const avatarError = typedAvatar && !validAvatar(typedAvatar) ? '1 or 2 characters, or one emoji' : '';
  const typedType = normalizeLabel(type);
  // Another of the user's platforms with that name, case aside: saving merges into it.
  const other = platforms.find((p) => p.id !== platform.id && platformKey(p.name) === platformKey(typedName));
  const previewName = typedName || platform.name;

  const patch = (): PlatformPatch => {
    const p: PlatformPatch = {};
    if (typedName !== platform.name) p.name = typedName;
    if (typedType !== platform.type) p.type = typedType || null;
    if ((typedAvatar || null) !== platform.avatarText) p.avatarText = typedAvatar || null;
    if (color !== platform.color) p.color = color;
    return p;
  };
  const unchanged = Object.keys(patch()).length === 0;

  const problem = () =>
    !typedName
      ? 'Please enter a name'
      : [...typedName].length > MAX_PLATFORM_NAME
        ? `Keep the name under ${MAX_PLATFORM_NAME} characters`
        : avatarError
          ? `Thumbnail: ${avatarError}`
          : [...typedType].length > MAX_PLATFORM_TYPE
            ? `Keep the type under ${MAX_PLATFORM_TYPE} characters`
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
          title={`Merge into ${other.name}?`}
          message={platformMergeMessage(platform, other)}
          confirmLabel="Merge"
          busyLabel="Merging…"
          tone="primary"
          failureMessage="Could not merge these platforms. Please try again."
          onConfirm={async () => {
            await updatePlatform(platform.id, { name: other.name, mergeIfExists: true });
            toast.success(`Merged into ${other.name}`);
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
      setError(errorMessage(err, 'Could not save this platform. Please try again.'));
      setSaving(false);
      return;
    }
    toast.success('Changes saved');
    onClose();
  };

  const resetLook = () => {
    setAvatar('');
    setColor(null);
  };

  return (
    <Modal title={`Customize ${platform.name}`} onClose={onClose} busy={saving}>
      {error && <FormError>{error}</FormError>}
      <form onSubmit={save} noValidate className="dialog-form">
        <div className="platform-preview" aria-live="polite">
          <PlatformAvatar text={typedAvatar && !avatarError ? typedAvatar : initialOf(previewName)} color={color ?? platformColor(platform.name)} size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="platform-preview-name">{previewName}</div>
            <div className="text-muted">
              {typedType || 'Other'} · {assets(platform.holdingsCount)}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor={ids.avatar}>Thumbnail</label>
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
            {avatarError || '1 or 2 letters, or an emoji. Empty: its initial.'}
          </div>
        </div>

        <ColorPicker label="Color" value={color} onChange={setColor} defaultColor={platformColor(platform.name)} />

        <Combobox label="Type" value={type} onChange={setType} options={PLATFORM_TYPES} placeholder="Other" />

        <div className="field">
          <label htmlFor={ids.name}>Name</label>
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
              ? `${other.name} already exists: saving merges ${platform.name} into it.`
              : typedName !== platform.name && typedName
                ? `Renames it on its ${assets(platform.holdingsCount)}.`
                : `Renaming changes it on all its ${assets(platform.holdingsCount)}.`}
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost dialog-actions-start" onClick={resetLook} disabled={saving || (!avatar && color === null)}>
            Reset to default
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || (unchanged && !other)}>
            {saving ? 'Saving…' : other ? 'Merge…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
