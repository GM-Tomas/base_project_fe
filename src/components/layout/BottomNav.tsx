'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { accountLabel } from '@/lib/account';
import { navItem } from './navItems';
import type { ViewType } from '@/types/wealth';

const EVERYDAY: ViewType[] = ['dashboard', 'assets', 'debts', 'history'];
const MORE: ViewType[] = ['platforms', 'estimate', 'settings'];

// On a phone, the navigation is a bar along the bottom: the everyday views, and More for the rest and the
// account.
export function BottomNav() {
  const { view, setView } = useWealth();
  const { openDialog } = useUi();
  const inMore = MORE.includes(view);

  return (
    <nav aria-label="Main" className="bottom-nav">
      {EVERYDAY.map((id) => {
        const item = navItem(id);
        return (
          <button
            key={id}
            type="button"
            className="bottom-nav-item"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={inMore ? 'bottom-nav-item bottom-nav-item-in' : 'bottom-nav-item'}
        aria-haspopup="dialog"
        onClick={() => openDialog((close) => <MoreSheet onClose={close} />)}
      >
        <MoreHorizontal size={18} aria-hidden />
        <span>More</span>
      </button>
    </nav>
  );
}

// More, from the bottom bar: the other views, and the account.
function MoreSheet({ onClose }: { onClose: () => void }) {
  const { view, setView } = useWealth();
  const { openDialog } = useUi();
  const { user } = useAuth();
  const { name, initial } = accountLabel(user);

  return (
    <Modal title="More" onClose={onClose} className="sheet">
      <div className="sheet-list">
        {MORE.map((id) => {
          const item = navItem(id);
          return (
            <button
              key={id}
              type="button"
              className="sheet-item"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setView(id);
                onClose();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="sheet-item"
          onClick={() => {
            onClose();
            openDialog((close) => <ProfileModal onClose={close} />);
          }}
        >
          <span className="sheet-avatar" aria-hidden>
            {initial}
          </span>
          <span>
            {name}
            <span className="sheet-sub">Profile and sign out</span>
          </span>
        </button>
      </div>
    </Modal>
  );
}
