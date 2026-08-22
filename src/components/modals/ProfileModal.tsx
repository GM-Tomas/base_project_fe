'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWealth } from '@/context/WealthContext';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, signOut } = useAuth();
  const { platforms, netWorthFormatted } = useWealth();

  if (!user) return null;

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Account';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Profile</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              style={{ width: '52px', height: '52px', borderRadius: '50%', flex: 'none' }}
            />
          ) : (
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
          )}
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
          <span style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
            Accounts linked
          </span>
          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{platforms.length}</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <span style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
            Net worth
          </span>
          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{netWorthFormatted}</span>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
