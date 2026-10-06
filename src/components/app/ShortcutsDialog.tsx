'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';

/** The keyboard shortcuts, as the help lists them (the keys are what the hotkeys listen for). */
export const SHORTCUTS: { key: string; does: string }[] = [
  { key: 'N', does: 'Add an asset' },
  { key: 'G', does: 'Record a gain or loss' },
  { key: 'T', does: 'Transfer between assets' },
  { key: 'D', does: 'Add a debt' },
  { key: 'S', does: 'Save a snapshot' },
  { key: '/', does: 'Search your assets' },
  { key: 'H', does: 'Hide or show amounts' },
  { key: '?', does: 'Show these shortcuts' },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="shortcut">
            <dt>
              <kbd>{s.key}</kbd>
            </dt>
            <dd>{s.does}</dd>
          </div>
        ))}
      </dl>
      <p className="dialog-text text-muted" style={{ margin: 0 }}>
        They work anywhere in BASE, except while you type in a field or a dialog is open.
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
