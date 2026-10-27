import { describe, expect, test } from 'vitest';
import { buildThemeCss, buildTokensCss, buildTokensJson } from './build';

describe('build', () => {
  test('build emits light, dark and system-dark blocks', () => {
    const css = buildTokensCss();
    expect(css).toContain(':root {');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  test('light and dark values land in the right blocks', () => {
    const css = buildTokensCss();
    expect(css).toMatch(/:root \{[^}]*--br-surface-canvas: #eef2f6;/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \{[^}]*--br-surface-canvas: #[0-9a-f]{6};/);
  });

  test('custom accent applies to the light block only', () => {
    const css = buildTokensCss();
    const light = css.slice(0, css.indexOf(':root[data-theme="dark"]'));
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    expect(light).toContain('--br-accent: var(--br-accent-custom, #0e7490);');
    expect(dark).not.toContain('--br-accent-custom');
    expect(dark).toContain('--br-accent: #38b6d4;');
  });

  test('accent-tint follows the accent via color-mix', () => {
    expect(buildTokensCss()).toContain(
      '--br-accent-tint: color-mix(in oklab, var(--br-accent) 12%, var(--br-surface));',
    );
  });

  test('theme.css maps Tailwind v4 utilities to --br-* vars', () => {
    const css = buildThemeCss();
    expect(css).toContain('@theme inline {');
    expect(css).toContain('--color-surface-canvas: var(--br-surface-canvas);');
    expect(css).toContain('--radius-card: var(--br-radius-card);');
    expect(css).toContain('--font-sans: var(--br-font-sans);');
    expect(css).toContain('--spacing: 4px;');
    expect(css).toContain('--shadow-row: var(--br-shadow-row);');
  });

  test('tokens.css defines radius, shadows and font vars', () => {
    const css = buildTokensCss();
    expect(css).toContain('--br-radius-input: 8px;');
    expect(css).toContain('--br-radius-card: 12px;');
    expect(css).toContain('--br-radius-dialog: 14px;');
    expect(css).toContain('--br-radius-pill: 999px;');
    expect(css).toContain('--br-shadow-row: 0 1.5px 0 rgba(31, 42, 55, 0.07);');
  });

  test('tokens.json contains both modes', () => {
    const json = JSON.parse(buildTokensJson());
    expect(json.semantic.accent.light).toBe('#0e7490');
    expect(json.semantic.accent.dark).toMatch(/^#[0-9a-f]{6}$/);
  });
});
