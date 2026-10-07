'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useT } from '@/lib/i18n';

/** The keyboard shortcuts' keys, in the order the help lists them (what each does is the language's). */
export const SHORTCUTS = ['N', 'G', 'T', 'D', 'S', '/', 'H', '?'];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const tAll = useT();
  const t = tAll.shortcuts;
  return (
    <Modal title={t.title} onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map((key) => (
          <div key={key} className="shortcut">
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{t.does[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="dialog-text text-muted" style={{ margin: 0 }}>
        {t.note}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {tAll.common.done}
        </button>
      </div>
    </Modal>
  );
}
