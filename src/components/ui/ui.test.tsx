import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { TOAST_MS } from './Toaster';
import { UiProvider, useUi } from '@/context/UiContext';
import { ApiError } from '@/lib/apiError';

afterEach(() => vi.useRealTimers());

describe('Modal', () => {
  it('is a modal dialog named by its title, focused on its first control', () => {
    render(
      <Modal title="Edit things" onClose={() => {}}>
        <p>Not focusable</p>
        <input aria-label="First" />
        <button>Last</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit things' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('First'));
  });

  it('focuses what it is told to, or itself when it has no controls', () => {
    const Wanted = () => {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Modal title="T" onClose={() => {}} initialFocusRef={ref}>
          <input aria-label="First" />
          <button ref={ref}>Wanted</button>
        </Modal>
      );
    };
    const { unmount } = render(<Wanted />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Wanted' }));
    unmount();

    render(
      <Modal title="Nothing to do" onClose={() => {}}>
        <p>Just text</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    // Tab has nowhere to go but stays inside.
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
  });

  it('keeps Tab and Shift+Tab inside', () => {
    render(
      <Modal title="T" onClose={() => {}}>
        <input aria-label="First" />
        <button disabled>Disabled</button>
        <button>Last</button>
      </Modal>,
    );
    const [first, last] = [screen.getByLabelText('First'), screen.getByRole('button', { name: 'Last' })];

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // From the dialog itself (a click on its text focuses it), Shift+Tab goes to the last control.
    screen.getByRole('dialog').focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // In between, Tab is the browser's: nothing is prevented.
    first.focus();
    expect(fireEvent.keyDown(first, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(first, { key: 'a' })).toBe(true);
  });

  it("closes on Escape, but not while it's busy", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal title="T" onClose={onClose} busy>
        <input aria-label="Field" />
      </Modal>,
    );
    const backdrop = document.querySelector('.dialog-backdrop')!;
    fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal title="T" onClose={onClose}>
        <input aria-label="Field" />
      </Modal>,
    );
    fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to what opened it', () => {
    const Opener = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal title="T" onClose={() => setOpen(false)}>
              <button onClick={() => setOpen(false)}>Done</button>
            </Modal>
          )}
        </>
      );
    };
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(opener);
  });
});

describe('ConfirmDialog', () => {
  it('reports a failure inside, and can be tried again', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValueOnce(new ApiError(409, 'Busy elsewhere')).mockResolvedValueOnce(undefined);
    render(
      <ConfirmDialog
        title="Delete it?"
        message="It goes away."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        tone="primary"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.className).toBe('btn btn-primary');

    await act(async () => fireEvent.click(confirm));
    expect(screen.getByText('Busy elsewhere')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic message when the API said nothing', async () => {
    render(
      <ConfirmDialog
        title="Delete it?"
        message="It goes away."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        onConfirm={() => Promise.reject(new TypeError('offline'))}
        onClose={() => {}}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
  });
});

describe('UiProvider', () => {
  let ui!: ReturnType<typeof useUi>;
  const Probe = () => {
    ui = useUi();
    return null;
  };
  const renderUi = () =>
    render(
      <UiProvider>
        <Probe />
      </UiProvider>,
    );

  it('stacks dialogs and closes each one on its own', () => {
    renderUi();
    let closeFirst!: () => void;
    act(() => {
      closeFirst = ui.openDialog((close) => (
        <Modal title="First" onClose={close}>
          <button>One</button>
        </Modal>
      ));
    });
    act(() => {
      ui.openDialog((close) => (
        <Modal title="Second" onClose={close}>
          <button onClick={close}>Close second</button>
        </Modal>
      ));
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Close second' }));
    expect(screen.getByRole('dialog', { name: 'First' })).toBeTruthy();
    act(() => closeFirst());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('announces successes politely and errors right away', () => {
    renderUi();
    act(() => {
      ui.toast.success('Asset added');
      ui.toast.error('Could not reach the server');
    });
    expect(within(screen.getByRole('status')).getByText('Asset added')).toBeTruthy();
    expect(within(screen.getByRole('alert')).getByText('Could not reach the server')).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('dismisses toasts on their own, or with their button', () => {
    vi.useFakeTimers();
    renderUi();
    act(() => ui.toast.success('Saved'));
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(screen.getByText('Saved')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved')).toBeNull();

    act(() => ui.toast.success('Saved again'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Saved again')).toBeNull();
  });

  it('waits while the pointer or the keyboard is on a toast', () => {
    vi.useFakeTimers();
    renderUi();
    act(() => ui.toast.success('Transfer recorded', { action: { label: 'Undo', onClick: () => {} } }));
    const toast = screen.getByText('Transfer recorded').parentElement!;

    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(TOAST_MS * 3));
    expect(screen.getByText('Transfer recorded')).toBeTruthy();
    fireEvent.mouseLeave(toast);

    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(TOAST_MS * 3));
    expect(screen.getByText('Transfer recorded')).toBeTruthy();
    fireEvent.blur(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByText('Transfer recorded')).toBeNull();
  });

  it("runs a toast's action and closes it", () => {
    renderUi();
    const undo = vi.fn();
    act(() => ui.toast.success('Gain recorded', { action: { label: 'Undo', onClick: undo } }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Gain recorded')).toBeNull();
  });

  it('shows the latest four toasts at most', () => {
    renderUi();
    act(() => {
      for (let i = 1; i <= 6; i++) ui.toast.success(`Toast ${i}`);
    });
    expect(screen.queryByText('Toast 2')).toBeNull();
    expect(screen.getAllByText(/^Toast [3-6]$/)).toHaveLength(4);
  });

  it('throws outside its provider', () => {
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useUi must be used within a UiProvider');
    window.removeEventListener('error', swallow);
  });
});
