import React from 'react';
import { graphemeCount } from '@/lib/customization';

export interface PlatformAvatarProps {
  /** What it shows: the user's text, or the platform's initial. */
  text: string;
  color: string;
  /** Its side in px: 34 on cards, 18 next to a name. */
  size?: number;
}

// A platform's thumbnail: its letters or emoji on a tint of its color. Decorative: the platform's name is
// always next to it.
export function PlatformAvatar({ text, color, size = 34 }: PlatformAvatarProps) {
  const two = graphemeCount(text) > 1;
  // Small ones keep their letters readable: never under 8px.
  const fontSize = Math.max(8, Math.round(size * (two ? 0.34 : 0.42)));
  return (
    <span
      className="platform-avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize,
        borderRadius: Math.round(size * 0.26),
        background: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
        color,
      }}
    >
      {text}
    </span>
  );
}
