'use client';

import React, { type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  children: ReactNode;
  /** Reload's other half: the app's data, read again. */
  onReload: () => void;
}

// A view that fails to render says so in its place, with Reload, instead of taking the whole app down: the
// navigation and the other views keep working.
export class ViewBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('A view failed to render', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card elev-sm" role="alert">
        <EmptyState
          title="Something went wrong in this view"
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onReload();
              }}
            >
              Reload
            </button>
          }
        >
          The rest of BASE still works. Reload this view to try again.
        </EmptyState>
      </div>
    );
  }
}
