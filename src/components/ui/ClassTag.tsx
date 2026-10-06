'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';
import { assetClassTag } from '@/lib/constants';

// A class's name as a tag: in the user's color for it, or in its default style.
export function ClassTag({ name }: { name: string }) {
  const { classLook } = useWealth();
  const { custom } = classLook(name);
  if (!custom) return <span className={assetClassTag(name)}>{name}</span>;
  return (
    <span className="tag tag-custom" style={{ '--tag-color': custom } as React.CSSProperties}>
      {name}
    </span>
  );
}
