import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const packages = resolve(root, '..');

/**
 * Each style rule's selector with the at-rules around it (`@media …`, `@supports …`, `@layer …`).
 * Minified Tailwind output has no strings or comments with braces, so counting braces is enough.
 */
function styleRules(css: string): string[] {
  const rules: string[] = [];
  const stack: string[] = [];
  let prelude = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') {
      stack.push(prelude.trim());
      prelude = '';
    } else if (ch === '}') {
      stack.pop();
      prelude = '';
    } else if (ch === ';') {
      prelude = '';
    } else {
      prelude += ch;
    }
    if (ch === '{') {
      const selector = stack.at(-1) ?? '';
      if (!selector.startsWith('@')) rules.push(stack.join(' > '));
    }
  }
  return rules;
}

describe('dist/styles.css', () => {
  beforeAll(() => {
    execSync('pnpm build:css', { cwd: root, stdio: 'pipe' });
    for (const pkg of ['renderer', 'inertia']) {
      execSync('pnpm build:css', { cwd: resolve(packages, pkg), stdio: 'pipe' });
    }
  }, 60_000);

  it("one sheet holds every package's utilities", () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    // Used only in the renderer (an editable cell's checkbox list) and only in inertia (login title).
    expect(css).toContain('.br\\:gap-x-4{');
    expect(css).toContain('.br\\:font-bold{');
    expect(css).toContain('.br\\:md\\:max-xl\\:grid-cols-2');
  });

  it('each utility is defined once', () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    const rules = styleRules(css).filter((rule) => rule.includes('.br\\:'));
    expect(rules.length).toBeGreaterThan(100);
    const seen = new Set<string>();
    const repeated = rules.filter((rule) => seen.has(rule) || !seen.add(rule));
    expect(repeated).toEqual([]);
  });

  it('pl-10 comes after px-3', () => {
    // A search field's room for its icon (pl-10) must beat the control's own padding (px-3).
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    const px = css.indexOf('.br\\:px-3{');
    const pl = css.indexOf('.br\\:pl-10{');
    expect(px).toBeGreaterThan(-1);
    expect(pl).toBeGreaterThan(px);
  });

  it('renderer and inertia ship empty compatibility sheets', () => {
    for (const pkg of ['renderer', 'inertia']) {
      const css = readFileSync(resolve(packages, pkg, 'dist/styles.css'), 'utf8');
      expect(css.replace(/\/\*[\s\S]*?\*\//g, '').trim(), pkg).toBe('');
    }
  });

  it('references only font files that exist in dist', () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      if (u.startsWith('data:')) continue;
      expect(existsSync(resolve(root, 'dist', u)), u).toBe(true);
    }
  });

  it('emits only br:-prefixed utilities', () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    expect(css).toContain('.br\\:bg-accent');
    expect(css).not.toMatch(/\.bg-accent/);
  });

  it('uses no var(--x) without a definition', () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = [...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1] as string);
    // Set inline by the element that uses it (style={{ '--br-filter-columns': … }}).
    const inline = new Set(['--br-filter-columns']);
    const undefinedVars = used.filter(
      (v) =>
        !defined.has(v) && !inline.has(v) && !v.startsWith('--tw-') && !v.startsWith('--radix-'),
    );
    expect(new Set(undefinedVars)).toEqual(new Set());
  });

  it("scopes view-transition rules to Brume's own theme switch", () => {
    const css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
    const rules = [...css.matchAll(/([^{}]*)::view-transition[^{]*\{/g)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toContain('[data-brume-theme-switch]');
  });
});
