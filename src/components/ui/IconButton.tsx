import React from 'react';

export interface IconButtonProps {
  /** What it does, naming what it acts on ("Remove Bitcoin"): its accessible name and tooltip. */
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({ label, onClick, children, tone }) => (
  <button
    type="button"
    className={tone === 'danger' ? 'icon-btn icon-btn-danger' : 'icon-btn'}
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
);
