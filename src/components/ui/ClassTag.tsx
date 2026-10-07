'use client';

import React from 'react';
import { useWealth } from '@/context/WealthContext';

// A class: a dot of its color (the user's, or its default) and its name.
export function ClassTag({ name }: { name: string }) {
  const { classLook } = useWealth();
  return (
    <span className="class-tag">
      <span className="class-dot" style={{ background: classLook(name).color }} aria-hidden />
      {name}
    </span>
  );
}
