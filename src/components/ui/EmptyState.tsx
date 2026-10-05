import React from 'react';

export interface EmptyStateProps {
  title: string;
  children?: React.ReactNode;
  /** The button that gets the user started. */
  action?: React.ReactNode;
}

/** What goes here and how to start: shown instead of an empty table, chart or grid. */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, children, action }) => (
  <div className="empty-state">
    <div className="empty-state-title">{title}</div>
    {children && <p className="empty-state-text">{children}</p>}
    {action}
  </div>
);
