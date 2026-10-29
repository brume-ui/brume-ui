import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * brume-react owns how Brume looks; the renderer only arranges. On its own elements the renderer
 * writes layout utilities (display, flex and grid, spacing, size, position, overflow, text flow)
 * and never visual ones (colour, background, border, radius, shadow, type). Anything that needs a
 * look is a brume-react component (Alert, ActionBar, …), so a token or theme change lands in one
 * place and the renderer cannot drift from it.
 *
 * Every string literal in the renderer's sources is checked, not just `className` attributes, so
 * class constants (`const edge = 'br:items-end'`) are covered too.
 */
const LAYOUT: RegExp[] = [
  /^(?:flex|inline-flex|grid|contents|block|inline|hidden|sr-only)(?:$|-)/,
  /^(?:gap|items|justify|content|self|place|col|row|order|basis)-/,
  /^(?:grow|shrink)(?:$|-)/,
  /^(?:w|h|size|min|max)-/,
  // Spacing: p-4, px-3, pl-10, m-2, -mt-1, ms-auto.
  /^p[xytblrse]?-/,
  /^m[xytblrse]?-/,
  /^overflow-/,
  /^(?:relative|absolute|sticky|fixed)$/,
  /^(?:inset|top|bottom|left|right|z)-/,
  /^@container(?:$|\/)/,
  // Text flow and replaced content: where the text breaks, not how it looks.
  /^(?:truncate)$/,
  /^(?:whitespace|break|object)-/,
  // Arbitrary grid placement, e.g. `[grid-row:auto]`.
  /^\[grid-(?:row|column):[^\]]+\]$/,
];

/** Variant prefixes (`sm:`, `max-sm:`, `@md:`, `empty:`): the utility after them is what counts. */
const VARIANTS = /^(?:(?:@?[a-z0-9-]+|\[[^\]]+\]|[a-z-]+-\[[^\]]+\]):)+/;

function isLayout(utility: string): boolean {
  const bare = utility.replace(VARIANTS, '').replace(/^-/, '').replace(/!$/, '');
  return LAYOUT.some((pattern) => pattern.test(bare));
}

/** Visual `br:` utilities in `source`, as "file:line br:utility". */
function findVisualClasses(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: string[] = [];
  const check = (node: ts.Node, text: string) => {
    for (const cls of text.split(/\s+/)) {
      if (!cls.startsWith('br:') || isLayout(cls.slice(3))) continue;
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      hits.push(`${fileName}:${line + 1} ${cls}`);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      check(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      check(node, node.head.text);
      for (const span of node.templateSpans) check(span, span.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('no visual classes in the renderer', () => {
  it('accepts layout utilities, with breakpoint and state variants', () => {
    const source = `
      export const a = <div className="br:flex br:flex-wrap br:items-center br:gap-2 br:px-4 br:py-2" />;
      export const b = <div className="br:grid br:max-md:grid-cols-1 br:md:max-xl:grid-cols-2 br:@container" />;
      export const c = <div className="br:min-w-0 br:max-w-full br:size-4 br:sticky br:top-0 br:z-10" />;
      export const d = <span className="br:sr-only br:truncate br:break-words br:whitespace-pre-wrap" />;
      export const e = <div className="br:empty:hidden br:max-sm:ms-auto br:-mt-1 br:max-sm:[grid-row:auto]!" />;
      const edge = 'br:items-end';
    `;
    expect(findVisualClasses('x.tsx', source)).toEqual([]);
  });

  it('flags colour, background, border, radius, shadow and type', () => {
    const source = [
      '<div className="br:flex br:rounded-card br:border br:border-danger br:bg-surface" />;',
      "const tone = 'br:text-danger br:shadow-row br:font-semibold br:text-sm';",
      `<p className={\`br:gap-1 \${x} br:hover:bg-surface-canvas\`} />;`,
    ].join('\n');
    expect(findVisualClasses('x.tsx', source)).toEqual([
      'x.tsx:1 br:rounded-card',
      'x.tsx:1 br:border',
      'x.tsx:1 br:border-danger',
      'x.tsx:1 br:bg-surface',
      'x.tsx:2 br:text-danger',
      'x.tsx:2 br:shadow-row',
      'x.tsx:2 br:font-semibold',
      'x.tsx:2 br:text-sm',
      'x.tsx:3 br:hover:bg-surface-canvas',
    ]);
  });

  it('finds none in packages/renderer/src', () => {
    const root = import.meta.dirname;
    const files = sources(root);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((path) =>
      findVisualClasses(relative(root, path), readFileSync(path, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
