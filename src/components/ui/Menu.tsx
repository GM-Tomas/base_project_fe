'use client';

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  /** Its keyboard shortcut. */
  shortcut?: string;
  run: () => void;
  /** Why it can't be done now (it's disabled then). */
  unavailable?: string;
  tone?: 'danger';
}

export interface MenuProps {
  /** The menu's name, and its button's when the button shows only an icon. */
  label: string;
  /** What the button shows. */
  children: React.ReactNode;
  buttonClassName: string;
  /** Items in groups, a separator between groups. */
  groups: MenuItem[][];
  /** The button shows only an icon: name it with the label. */
  iconOnly?: boolean;
}

const GAP = 6;

// A button that opens a list of actions (New ▾, a row's ⋯). The list sits above everything, under the button
// or above it when there's no room, and closes on a click outside, Escape, Tab, a scroll or a resize. Arrow
// keys, Home and End move through it; focus goes back to the button.
export function Menu({ label, children, buttonClassName, groups, iconOnly }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({});
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const enabled = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current!.getBoundingClientRect();
    const height = menuRef.current!.offsetHeight;
    const right = Math.max(GAP, window.innerWidth - button.right);
    setPlace(
      button.bottom + GAP + height > window.innerHeight && button.top - GAP - height > 0
        ? { right, bottom: window.innerHeight - button.top + GAP }
        : { right, top: button.bottom + GAP },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    enabled()[0]?.focus();
    const closeOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    // A scroll inside the list keeps it; the page's (or a resize, on the window) closes it.
    const closeOnMove = (e: Event) => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('scroll', closeOnMove, true);
    window.addEventListener('resize', closeOnMove);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('scroll', closeOnMove, true);
      window.removeEventListener('resize', closeOnMove);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (item: MenuItem) => {
    // A dialog it opens gives the focus back to the button when it closes.
    close();
    item.run();
  };
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = enabled();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next: Record<string, () => number> = {
      ArrowDown: () => (at + 1) % items.length,
      ArrowUp: () => (at - 1 + items.length) % items.length,
      Home: () => 0,
      End: () => items.length - 1,
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (next[e.key]) {
      e.preventDefault();
      items[next[e.key]()]?.focus();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="menu" role="menu" aria-label={label} style={place} onKeyDown={onMenuKeyDown}>
          {groups.map((group, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="menu-separator" role="separator" />}
              {group.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={item.tone === 'danger' ? 'menu-item menu-item-danger' : 'menu-item'}
                  disabled={Boolean(item.unavailable)}
                  title={item.unavailable}
                  aria-keyshortcuts={item.shortcut}
                  tabIndex={-1}
                  onClick={() => choose(item)}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd aria-hidden>{item.shortcut}</kbd>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
}
