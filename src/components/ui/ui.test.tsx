import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { ColorPicker } from './ColorPicker';
import { Menu } from './Menu';
import { MoneyInput } from './MoneyInput';
import { Tabs } from './Tabs';
import { PlatformAvatar } from './PlatformAvatar';
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

describe('ColorPicker', () => {
  const Picker = ({ initial }: { initial: string | null }) => {
    const [color, setColor] = useState<string | null>(initial);
    return (
      <>
        <ColorPicker label="Color" value={color} onChange={setColor} defaultColor="var(--color-accent)" />
        <output aria-label="Picked">{color ?? 'default'}</output>
      </>
    );
  };
  const picked = () => screen.getByLabelText('Picked').textContent;

  it('picks the default, one of the palette or one of your own', () => {
    render(<Picker initial="#123456" />);
    // A color of one's own shows in the hex field.
    expect((screen.getByLabelText('Or your own') as HTMLInputElement).value).toBe('#123456');
    expect((screen.getByRole('radio', { name: 'Default' }) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole('radio', { name: 'Teal' }));
    expect(picked()).toBe('#00c0c2');
    expect((screen.getByLabelText('Or your own') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('radio', { name: 'Default' }));
    expect(picked()).toBe('default');

    fireEvent.change(screen.getByLabelText('Or your own'), { target: { value: 'zz' } });
    expect(screen.getByText('Use a hex color like #1a2b3c')).toBeTruthy();
    expect(picked()).toBe('default');
    fireEvent.change(screen.getByLabelText('Or your own'), { target: { value: ' #ABCDEF ' } });
    expect(picked()).toBe('#abcdef');

    fireEvent.change(screen.getByLabelText('Pick a color'), { target: { value: '#00ff88' } });
    expect(picked()).toBe('#00ff88');
    expect((screen.getByLabelText('Or your own') as HTMLInputElement).value).toBe('#00ff88');
  });
});

describe('Menu', () => {
  const ROW = { left: 900, right: 930, width: 30, height: 30, x: 900, y: 0, toJSON: () => ({}) };
  const renderMenu = (run = vi.fn(), remove = vi.fn()) =>
    render(
      <Menu
        label="Actions for SPY"
        iconOnly
        buttonClassName="icon-btn"
        groups={[[{ label: 'Edit', run }, { label: 'Later', run, unavailable: 'Not yet' }], [{ label: 'Remove', tone: 'danger', run: remove }]]}
      >
        ⋯
      </Menu>,
    );

  it('opens its actions under the button, moves through them, and gives the focus back', () => {
    const edit = vi.fn();
    renderMenu(edit);
    const button = screen.getByRole('button', { name: 'Actions for SPY' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ ...ROW, top: 100, bottom: 130 } as DOMRect);
    fireEvent.click(button);

    const menu = screen.getByRole('menu', { name: 'Actions for SPY' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(menu.style.top).toBe('136px');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Later', 'Remove']);
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Edit' }));
    // The unavailable one is skipped.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement!.textContent).toBe('Remove');
    expect(document.activeElement!.className).toContain('menu-item-danger');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(edit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it("opens above the button when there's no room under it, and closes on a scroll", () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Actions for SPY' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ ...ROW, top: 740, bottom: 770 } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    expect(menu.style.top).toBe('');
    expect(menu.style.bottom).toBe(`${window.innerHeight - 740 + 6}px`);
    fireEvent.scroll(menu);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Tabs', () => {
  function Example() {
    const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
    const tabs = [
      { id: 'a' as const, label: 'Overview' },
      { id: 'b' as const, label: 'Checkpoints' },
      { id: 'c' as const, label: 'Activity' },
    ];
    return (
      <Tabs label="History" tabs={tabs} value={tab} onChange={setTab}>
        <p>Panel {tab}</p>
      </Tabs>
    );
  }

  it('shows the picked tab only, and moves between them with the arrow keys, Home and End', () => {
    render(<Example />);
    const list = screen.getByRole('tablist', { name: 'History' });
    const selected = () => screen.getByRole('tab', { selected: true });
    expect(selected().textContent).toBe('Overview');
    expect(screen.getByRole('tabpanel', { name: 'Overview' }).textContent).toBe('Panel a');
    // Only the picked one is in the tab order.
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([0, -1, -1]);

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel c');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected().textContent).toBe('Overview');
    expect(document.activeElement).toBe(selected());
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selected().textContent).toBe('Activity');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selected().textContent).toBe('Overview');
    fireEvent.keyDown(list, { key: 'End' });
    expect(selected().textContent).toBe('Activity');
    fireEvent.keyDown(list, { key: 'x' });
    expect(selected().textContent).toBe('Activity');
  });
});

describe('MoneyInput', () => {
  function Field() {
    const [value, setValue] = useState('');
    return <MoneyInput label="Amount" value={value} onChange={setValue} />;
  }

  it('says how an amount was read only when that is not plain to see', () => {
    render(<Field />);
    const type = (value: string) => fireEvent.change(screen.getByLabelText('Amount'), { target: { value } });
    type('900');
    expect(screen.queryByText(/^= /)).toBeNull();
    type('1.500');
    expect(screen.getByText('= $1,500.00')).toBeTruthy();
    type('900.5');
    expect(screen.getByText('= $900.50')).toBeTruthy();
    type('abc');
    expect(screen.getByLabelText('Amount').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('PlatformAvatar', () => {
  it('fits two characters a little smaller than one', () => {
    const { container } = render(
      <>
        <PlatformAvatar text="B" color="#ff0000" />
        <PlatformAvatar text="BN" color="#ff0000" size={18} />
      </>,
    );
    const [one, two] = container.querySelectorAll<HTMLElement>('.platform-avatar');
    expect(one.style.fontSize).toBe('14px');
    expect(two.style.fontSize).toBe('8px'); // never under 8px
    expect(one.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows its letters in its color on a tint of it, or in theirs on its color', () => {
    const { container } = render(
      <>
        <PlatformAvatar text="B" color="#ff0000" />
        <PlatformAvatar text="B" color="#ff0000" textColor="#ffffff" />
      </>,
    );
    const [tint, solid] = container.querySelectorAll<HTMLElement>('.platform-avatar');
    expect(tint.style.color).toBe('rgb(255, 0, 0)');
    expect(tint.style.background).toContain('color-mix');
    expect(solid.style.color).toBe('rgb(255, 255, 255)');
    expect(solid.style.background).toBe('rgb(255, 0, 0)');
  });
});
