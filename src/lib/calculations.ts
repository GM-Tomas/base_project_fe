import { MONTH_NAMES } from './constants';

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
 * Future value calculation given principal, monthly payment, annual interest rate and years
 */
export function fvYears(principal: number, monthlyPayment: number, annualPct: number, years: number): number {
  const r = annualPct / 100 / 12;
  const n = years * 12;
  if (Math.abs(r) < 1e-9) return principal + monthlyPayment * n;
  return principal * Math.pow(1 + r, n) + monthlyPayment * ((Math.pow(1 + r, n) - 1) / r);
}

/**
 * Future value calculation given principal, monthly payment, annual interest rate and months
 */
export function fvMonths(principal: number, monthlyPayment: number, annualPct: number, nMonths: number): number {
  const r = annualPct / 100 / 12;
  if (Math.abs(r) < 1e-9) return principal + monthlyPayment * nMonths;
  return principal * Math.pow(1 + r, nMonths) + monthlyPayment * ((Math.pow(1 + r, nMonths) - 1) / r);
}

/**
 * Calculate the number of months required to reach a specific financial threshold
 */
export function monthsToReach(
  threshold: number,
  principal: number,
  monthlyPayment: number,
  annualPct: number,
  maxMonths: number
): number | null {
  for (let m = 0; m <= maxMonths; m++) {
    if (fvMonths(principal, monthlyPayment, annualPct, m) >= threshold) {
      return m;
    }
  }
  return null;
}

/**
 * Calculate future calendar date (e.g. "Aug 2029") from months delta from current base (Aug 2026)
 */
export function dateLabelFromMonths(monthsFromNow: number, baseMonthIndex: number = 7, baseYear: number = 2026): string {
  const total = baseMonthIndex + monthsFromNow;
  const year = baseYear + Math.floor(total / 12);
  const idx = total % 12;
  return `${MONTH_NAMES[idx]} ${year}`;
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
