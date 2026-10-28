import { describe, expect, test } from 'vitest';
import { buildMotionThemeCss, buildThemeCss, buildTokensCss, buildTokensJson } from './build';
import { duration, easing, reducedDuration } from './motion';

describe('motion tokens', () => {
  test('tokens.css defines every duration and easing', () => {
    const css = buildTokensCss();
    expect(css).toContain('--br-duration-instant: 100ms;');
    expect(css).toContain('--br-duration-fast: 150ms;');
    expect(css).toContain('--br-duration-base: 200ms;');
    expect(css).toContain('--br-duration-slow: 280ms;');
    expect(css).toContain('--br-ease-out: cubic-bezier(0.23, 1, 0.32, 1);');
    expect(css).toContain('--br-ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1);');
    expect(css).toContain('--br-ease-spring: cubic-bezier(0.34, 1.36, 0.64, 1);');
  });

  test('reduced motion collapses movement durations but keeps a short fade', () => {
    const css = buildTokensCss();
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('--br-duration-base: 0ms;');
    expect(block).toContain('--br-duration-slow: 0ms;');
    expect(block).toContain('--br-duration-fade: 100ms;');
    expect(Object.keys(reducedDuration).sort()).toEqual(Object.keys(duration).sort());
  });

  test('no easing is an ease-in curve (first control point must leave fast)', () => {
    for (const curve of Object.values(easing)) {
      const [x1, y1] = (curve.match(/[\d.]+/g) ?? []).map(Number);
      // ease-in curves start flat: y1 well below x1. Ours rise at least as fast as they advance.
      expect(y1).toBeGreaterThanOrEqual(x1 ?? 0);
    }
  });

  test('motion-theme.css (Brume builds only) sets easings, durations and removes ease-in', () => {
    const css = buildMotionThemeCss();
    expect(css).toContain('--ease-out: var(--br-ease-out);');
    expect(css).toContain('--ease-emphasized: var(--br-ease-emphasized);');
    expect(css).toContain('--ease-spring: var(--br-ease-spring);');
    expect(css).toContain('--ease-in: initial;');
    expect(css).toContain('--default-transition-timing-function: var(--br-ease-out);');
    expect(css).toMatch(
      /@utility duration-base \{[^}]*transition-duration: var\(--br-duration-base\);/,
    );
  });

  test('shared theme.css does not touch Tailwind motion defaults of host projects', () => {
    const css = buildThemeCss();
    expect(css).not.toMatch(/--ease-|--default-transition|--animate-|@utility|@keyframes/);
    // Every declaration only maps a Tailwind key to a --br-* value (or the spacing scale).
    const decls = [...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)];
    for (const [, name, value] of decls) {
      expect(name).toMatch(/^--(color|radius|shadow|font-sans|spacing)/);
      if (name !== '--spacing') expect(value).toMatch(/^var\(--br-/);
    }
  });

  test('tokens.json carries the motion scale', () => {
    const json = JSON.parse(buildTokensJson());
    expect(json.duration.base).toBe('200ms');
    expect(json.easing.out).toBe(easing.out);
  });
});
