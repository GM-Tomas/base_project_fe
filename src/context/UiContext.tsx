'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { Toaster, type ToastAction, type ToastItem } from '@/components/ui/Toaster';

type DialogRender = (close: () => void) => ReactNode;

export interface ToastOptions {
  action?: ToastAction;
}

interface UiContextType {
  /** Opens a dialog over whatever is open; render gets the function that closes it, which is also returned. */
  openDialog: (render: DialogRender) => () => void;
  toast: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
  };
}

const UiContext = createContext<UiContextType | undefined>(undefined);

// At most this many toasts at once: a burst of actions shows the latest ones.
const MAX_TOASTS = 4;

// Dialogs and toasts for everything under it. It lives inside the WealthProvider keyed by the account, so
// signing out or switching accounts drops whatever was open.
export const UiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogs, setDialogs] = useState<{ id: number; render: DialogRender }[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const openDialog = useCallback((render: DialogRender) => {
    const id = ++nextId.current;
    setDialogs((open) => [...open, { id, render }]);
    return () => setDialogs((open) => open.filter((d) => d.id !== id));
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useMemo(() => {
    const show = (tone: ToastItem['tone']) => (message: string, options?: ToastOptions) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, tone, message, action: options?.action }].slice(-MAX_TOASTS));
    };
    return { success: show('success'), error: show('error') };
  }, []);

  const value = useMemo(() => ({ openDialog, toast }), [openDialog, toast]);

  return (
    <UiContext.Provider value={value}>
      {children}
      {dialogs.map((d) => (
        <React.Fragment key={d.id}>{d.render(() => setDialogs((open) => open.filter((o) => o.id !== d.id)))}</React.Fragment>
      ))}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </UiContext.Provider>
  );
};

export const useUi = () => {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error('useUi must be used within a UiProvider');
  }
  return context;
};
