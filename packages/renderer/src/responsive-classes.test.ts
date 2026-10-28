import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An app bundles brume-react's, the renderer's and brume-inertia's styles.css into one file, and
 * the bundler merges duplicate rules: `.br:flex`, defined in every package, can end up after the
 * renderer's `@media (max-width: 40rem) { .br:max-sm:contents }` and win at every width. So a
 * utility that changes at a breakpoint must not have an unprefixed base for the same property on
 * the same element: write both sides as mutually exclusive variants (`br:sm:flex
 * br:max-sm:contents`), whose order cannot matter.
 */
const BREAKPOINT = /^(?:(?:max-)?(?:sm|md|lg|xl|2xl):)+/;

const GROUPS: Array<[string, RegExp]> = [
  [
    'display',
    /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|inline|contents|hidden|table)$/,
  ],
  ['width', /^w-/],
  ['justify-content', /^justify-(?:start|end|center|between|around|evenly|stretch|normal)$/],
  ['grid-template-columns', /^grid-cols-/],
  ['flex-direction', /^flex-(?:row|col)(?:-reverse)?$/],
];

function group(utility: string): string | undefined {
  return GROUPS.find(([, pattern]) => pattern.test(utility))?.[0];
}

/** Each class string whose breakpoint utility shares a property with an unprefixed one. */
function findConflicts(fileName: string, source: string): string[] {
  const conflicts: string[] = [];
  for (const match of source.matchAll(/(["'`])((?:br:[^\s"'`]+\s*)+)\1/g)) {
    const classes = (match[2] ?? '')
      .trim()
      .split(/\s+/)
      .map((c) => c.replace(/^br:/, ''));
    const base = new Set(classes.filter((c) => !BREAKPOINT.test(c) && !c.includes(':')).map(group));
    for (const cls of classes) {
      const variant = cls.match(BREAKPOINT)?.[0];
      if (!variant) continue;
      const property = group(cls.slice(variant.length));
      if (property && base.has(property)) {
        const line = source.slice(0, match.index).split('\n').length;
        conflicts.push(`${fileName}:${line} br:${cls} (${property})`);
      }
    }
  }
  return conflicts;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('responsive utilities', () => {
  it('finds a base utility overridden at a breakpoint', () => {
    expect(findConflicts('x.tsx', '<div className="br:flex br:max-sm:contents" />')).toEqual([
      'x.tsx:1 br:max-sm:contents (display)',
    ]);
    expect(findConflicts('x.tsx', '<div className="br:sm:flex br:max-sm:contents" />')).toEqual([]);
  });

  it('never overrides an unprefixed utility at a breakpoint in react, renderer or inertia sources', () => {
    const roots = ['renderer', 'inertia', 'react'].map((pkg) =>
      join(import.meta.dirname, '../..', pkg, 'src'),
    );
    const conflicts = roots.flatMap((root) =>
      sources(root).flatMap((file) =>
        findConflicts(
          relative(join(import.meta.dirname, '../..'), file),
          readFileSync(file, 'utf8'),
        ),
      ),
    );
    expect(conflicts).toEqual([]);
  });
});
