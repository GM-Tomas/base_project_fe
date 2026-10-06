/**
 * Format a USD value for display, in whole dollars: "$1,234", or "−$1,234" below zero (a net worth can be).
 */
export function formatCurrency(valUSD: number): string {
  const rounded = Math.round(valUSD);
  return (rounded < 0 ? '−$' : '$') + Math.abs(rounded).toLocaleString('en-US');
}

/** A change in whole dollars, with its sign: "+$1,235", "−$50", "$0". */
export function formatSignedCurrency(usd: number): string {
  const rounded = Math.round(usd);
  return (rounded > 0 ? '+' : '') + formatCurrency(rounded);
}

/** A change in %, to a tenth, with its sign: "+12.3%", "−4.0%", "0.0%". */
export function formatSignedPercentage(pct: number): string {
  const tenths = Math.round(pct * 10);
  return `${tenths > 0 ? '+' : tenths < 0 ? '−' : ''}${(Math.abs(tenths) / 10).toFixed(1)}%`;
}

/**
 * Format percentage with explicit +/- sign
 */
export function formatPercentage(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

/**
 * Generate smooth SVG path and coordinate points from an array of numbers. Lines drawn on one chart share a
 * scale: pass the lowest and highest of all of them as `scale` (each line's own otherwise).
 */
export function generateLinePath(
  values: number[],
  width: number,
  height: number,
  padding: number,
  scale?: { min: number; max: number }
): { pathString: string; points: [number, number][] } {
  if (!values.length) return { pathString: '', points: [] };
  if (values.length === 1) {
    const y = height / 2;
    return { pathString: `M ${padding},${y} L ${width - padding},${y}`, points: [[padding, y], [width - padding, y]] };
  }

  const min = scale?.min ?? Math.min(...values);
  const max = scale?.max ?? Math.max(...values);
  const range = max - min || 1;
  const step = (width - 2 * padding) / (values.length - 1);

  const points: [number, number][] = values.map((v, i) => [
    padding + i * step,
    padding + (height - 2 * padding) * (1 - (v - min) / range),
  ]);

  const pathString = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');

  return { pathString, points };
}
