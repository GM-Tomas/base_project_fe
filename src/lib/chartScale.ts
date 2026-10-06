import { amountsHidden, HIDDEN_COMPACT } from './privacy';

// What a chart's axes say: round values for the Y axis ($250k, $1.2M) and which years to label.

const STEPS = [1, 2, 2.5, 5, 10];

/** The smallest round step (1, 2, 2.5 or 5 × a power of ten) of at least rough. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  return STEPS.find((s) => s * power >= rough - 1e-9)! * power;
}

/**
 * About count + 1 round values from at or below min to at or above max, evenly spaced: a Y axis's ticks. Its
 * first and last are the scale to draw on.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) max = min + (Math.abs(min) || 1);
  const step = niceStep((max - min) / count);
  const first = Math.floor(min / step + 1e-9) * step;
  const last = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = first; v <= last + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const UNITS: [size: number, suffix: string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];

/** "$950", "$12.5k", "$250k", "$1.2M", "−$40k": an amount in a few characters. */
export function compactUsd(v: number): string {
  if (amountsHidden()) return HIDDEN_COMPACT;
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  const unit = UNITS.find(([size]) => abs >= size);
  if (!unit) return `${sign}$${Math.round(abs)}`;
  const [size, suffix] = unit;
  const scaled = abs / size;
  const digits = scaled >= 100 ? 0 : 1;
  return `${sign}$${Number(scaled.toFixed(digits))}${suffix}`;
}

/** The years to label on an X axis from 0 to years: at most about six, always the last. */
export function yearTicks(years: number): number[] {
  const step = Math.max(1, Math.ceil(years / 5));
  const ticks: number[] = [];
  for (let y = 0; y < years; y += step) ticks.push(y);
  // The last one, instead of the one before it if they'd be closer than a step.
  if (ticks.length > 1 && years - ticks[ticks.length - 1] < step) ticks.pop();
  ticks.push(years);
  return ticks;
}
