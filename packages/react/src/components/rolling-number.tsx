import { useEffect, useMemo, useState } from 'react';
import { cn } from '../cn';
import { usePrefersReducedMotion } from '../motion/reduced-motion';
import { useBrume } from '../provider';

export interface RollingNumberProps {
  value: number;
  /** Intl.NumberFormat options (currency, percent, fraction digits…). */
  format?: Intl.NumberFormatOptions;
  /** Defaults to the BrumeProvider locale. */
  locale?: string;
  /** Roll up from zeros on first render. Default true; skipped under reduced motion. */
  animateOnMount?: boolean;
  className?: string;
}

export type RollingPart =
  | { kind: 'digit'; digit: number; key: string }
  | { kind: 'char'; char: string; key: string };

/**
 * Splits a formatted number into digit columns and static characters. Keys count from the right,
 * so the units column stays the same element when the number gains digits (and keeps rolling).
 */
export function rollingParts(formatted: string): RollingPart[] {
  const chars = [...formatted];
  let digits = 0;
  let others = 0;
  const parts: RollingPart[] = [];
  for (let i = chars.length - 1; i >= 0; i--) {
    const char = chars[i] as string;
    if (/[0-9]/.test(char)) parts.push({ kind: 'digit', digit: Number(char), key: `d${digits++}` });
    else parts.push({ kind: 'char', char, key: `c${others++}` });
  }
  return parts.reverse();
}

/** Delay between neighbouring columns, right to left (an odometer carrying). */
const COLUMN_STAGGER_MS = 30;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number whose digits roll like an odometer when it changes (dashboard stats). Formatting
 * follows the locale; screen readers get the plain formatted value.
 */
export function RollingNumber({
  value,
  format,
  locale,
  animateOnMount = true,
  className,
}: RollingNumberProps) {
  const brume = useBrume();
  const reduced = usePrefersReducedMotion();
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale ?? brume.locale, format),
    [locale, brume.locale, format],
  );
  const formatted = formatter.format(value);
  const [settled, setSettled] = useState(!animateOnMount || reduced);

  useEffect(() => {
    if (settled) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [settled]);

  const parts = rollingParts(formatted);

  return (
    <span className={cn('br:inline-flex br:tabular-nums', className)}>
      <span className="br:sr-only">{formatted}</span>
      <span aria-hidden="true" data-rolling-number={formatted} className="br:inline-flex">
        {parts.map((part) => {
          if (part.kind === 'char') {
            return (
              <span key={part.key} className="br:whitespace-pre">
                {part.char}
              </span>
            );
          }
          const shown = settled ? part.digit : 0;
          const fromRight = Number(part.key.slice(1));
          return (
            <span
              key={part.key}
              className="br:relative br:inline-block br:h-[1lh] br:overflow-hidden"
            >
              <span
                data-digit={shown}
                className="br:flex br:flex-col br:transition-transform br:duration-[calc(var(--br-duration-slow)*2)] br:ease-emphasized"
                style={{
                  transform: `translateY(${-shown * 10}%)`,
                  transitionDelay: `${fromRight * COLUMN_STAGGER_MS}ms`,
                }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="br:h-[1lh]">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
