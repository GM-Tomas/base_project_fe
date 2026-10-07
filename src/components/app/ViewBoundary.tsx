'use client';

import React, { type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { messages } from '@/lib/i18n';

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
    const t = messages();
    return (
      <div className="card elev-sm" role="alert">
        <EmptyState
          title={t.app.viewFailed}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onReload();
              }}
            >
              {t.common.reload}
            </button>
          }
        >
          {t.app.viewFailedText}
        </EmptyState>
      </div>
    );
  }
}
