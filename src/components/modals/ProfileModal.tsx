'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWealth } from '@/context/WealthContext';
import { accountLabel } from '@/lib/account';
import { Modal } from '@/components/ui/Modal';
import { useT } from '@/lib/i18n';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, signOut } = useAuth();
  const { netWorthFormatted } = useWealth();
  const tAll = useT();
  const t = tAll.profile;

  if (!user) return null;

  const { name, initial } = accountLabel(user);

  // Modal portals to <body>, out of the Sidebar's stacking context, which would bury it under <main>.
  return (
    <Modal title={t.title} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--color-accent-800)',
            color: 'var(--color-accent-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 600,
            flex: 'none',
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{name}</div>
          {user.email && (
            <div
              style={{
                fontSize: '13px',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.email}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '14px 0',
          marginTop: '4px',
          borderTop: '1px solid var(--color-divider)',
          borderBottom: '1px solid var(--color-divider)',
          fontSize: '13px',
        }}
      >
        <span style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{t.netWorth}</span>
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{netWorthFormatted}</span>
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {tAll.common.close}
        </button>
        <button type="button" className="btn btn-primary" onClick={signOut}>
          {t.signOut}
        </button>
      </div>
    </Modal>
  );
};
