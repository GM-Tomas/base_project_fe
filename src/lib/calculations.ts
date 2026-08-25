/**
 * Format a USD value for display
 */
export function formatCurrency(valUSD: number): string {
  return '$' + Math.round(valUSD).toLocaleString('en-US');
}

/**
 * Format percentage with explicit +/- sign
 */
export function formatPercentage(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

/**
 * Generate smooth SVG path and coordinate points from an array of numbers
 */
export function generateLinePath(
  values: number[],
  width: number,
  height: number,
  padding: number
): { pathString: string; points: [number, number][] } {
  if (!values.length) return { pathString: '', points: [] };
  if (values.length === 1) {
    const y = height / 2;
    return { pathString: `M ${padding},${y} L ${width - padding},${y}`, points: [[padding, y], [width - padding, y]] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
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
