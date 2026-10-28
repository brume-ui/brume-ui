import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
let css = '';

describe('dist/styles.css', () => {
  beforeAll(() => {
    execSync('pnpm build:css', { cwd: root, stdio: 'pipe' });
    css = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');
  }, 60_000);

  it('emits the br: utilities the renderer uses', () => {
    for (const cls of [
      'br\\:border-danger',
      'br\\:text-danger',
      'br\\:grid',
      'br\\:max-md\\:grid-cols-1',
      'br\\:md\\:max-xl\\:grid-cols-2',
      'br\\:xl\\:grid-cols-3',
    ]) {
      expect(css, cls).toContain(`.${cls}`);
    }
    expect(css).not.toMatch(/\.grid\b/);
  });

  it('contains no preflight resets', () => {
    expect(css).not.toMatch(/(^|[}\s,])(\*|html|body|button|input|h1|:host),/);
    expect(css).not.toMatch(/(^|})\*,/);
    expect(css).not.toContain('box-sizing:border-box');
    expect(css).not.toContain('-webkit-text-size-adjust');
  });

  it('uses no var(--x) without a definition', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1] as string);
    // --br-* tokens are provided by brume-tokens' tokens.css, which the app loads separately.
    const missing = used.filter(
      (v) => !defined.has(v) && !v.startsWith('--tw-') && !v.startsWith('--br-'),
    );
    expect(new Set(missing)).toEqual(new Set());
  });
});
