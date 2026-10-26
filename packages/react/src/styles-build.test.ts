import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('dist/styles.css', () => {
  beforeAll(() => {
    execSync('pnpm build:css', { cwd: root, stdio: 'pipe' });
  }, 60_000);

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
    expect(css).toContain('.br\\:bg-surface-canvas');
    expect(css).not.toMatch(/\.bg-surface-canvas/);
  });
});
