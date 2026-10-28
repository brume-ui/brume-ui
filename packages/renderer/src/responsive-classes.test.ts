import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * An app bundles brume-react's, the renderer's and brume-inertia's styles.css into one file. Each
 * package's sheet is in Tailwind order on its own (base utilities before breakpoint variants), but
 * every package has its own copy of the common utilities, and the bundler keeps one copy of a
 * duplicate rule at its last position. So `.br:flex` from inertia's sheet can land after the
 * renderer's `@media (width >= 40rem) { .br:sm:hidden }` and win at every width.
 *
 * The rule that keeps this harmless: a breakpoint utility never shares a property with an
 * unprefixed utility on the same element. Write both sides as mutually exclusive variants
 * (`br:max-md:px-4 br:md:px-8`), whose order cannot matter. Two checks enforce it:
 *
 * 1. Classes on one element (a className, a cn() call, a class constant) never mix a breakpoint
 *    utility with an unprefixed one of the same property group.
 * 2. Breakpoint utilities are never passed as className to a component (a capitalised JSX tag):
 *    its own base classes are invisible here, so wrap it in an element that takes them.
 *    Radix parts (`Dialog.Content`) render plain elements without classes of their own, so
 *    namespaced tags are allowed.
 */
const BREAKPOINT = /^(?:(?:max-)?(?:sm|md|lg|xl|2xl):)+/;

const GROUPS: Array<[string, RegExp]> = [
  [
    'display',
    /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|inline|contents|hidden|table|sr-only|not-sr-only)$/,
  ],
  ['width', /^(?:w-|min-w-|max-w-)/],
  ['justify-content', /^justify-(?:start|end|center|between|around|evenly|stretch|normal)$/],
  ['grid-template-columns', /^grid-cols-/],
  ['flex-direction', /^flex-(?:row|col)(?:-reverse)?$/],
  // Spacing by axis: p-4 sets both, px-4 only the inline sides, so py-6 and md:px-8 do not clash.
  ['padding-inline', /^-?p[xlrse]?-/],
  ['padding-block', /^-?p[ytb]?-/],
  ['margin-inline', /^-?m[xlrse]?-/],
  ['margin-block', /^-?m[ytb]?-/],
  ['column-gap', /^gap(?:-x)?-/],
  ['row-gap', /^gap(?:-y)?-/],
];

/** The property groups a utility sets (spacing shorthands set two). */
function groups(utility: string): string[] {
  const bare = utility.replace(/!$/, '');
  return GROUPS.filter(([, pattern]) => pattern.test(bare)).map(([name]) => name);
}

/** `br:` utilities in a class string, without the prefix. */
function utilities(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((c) => c.startsWith('br:'))
    .map((c) => c.slice(3));
}

function conflictsIn(classes: string[]): string[] {
  const base = new Set(classes.filter((c) => !c.includes(':')).flatMap(groups));
  return classes.flatMap((cls) => {
    const variant = cls.match(BREAKPOINT)?.[0];
    if (!variant) return [];
    const clash = groups(cls.slice(variant.length)).filter((g) => base.has(g));
    return clash.length > 0 ? [`br:${cls} (${clash.join(', ')})`] : [];
  });
}

function stringsIn(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      found.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** Problems in one source file, as "file:line message". */
function findProblems(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  const at = (node: ts.Node, message: string) =>
    problems.push(
      `${fileName}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${message}`,
    );
  const inClassName = new Set<ts.Node>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'className' && node.initializer) {
      const classes = stringsIn(node.initializer).flatMap(utilities);
      for (const c of conflictsIn(classes)) at(node, c);
      const tag = (node.parent.parent as ts.JsxOpeningLikeElement).tagName;
      const component = ts.isIdentifier(tag) && /^[A-Z]/.test(tag.text);
      if (component) {
        for (const cls of classes.filter((c) => BREAKPOINT.test(c))) {
          at(node, `br:${cls} passed to <${tag.text}>`);
        }
      }
      const mark = (n: ts.Node) => {
        inClassName.add(n);
        ts.forEachChild(n, mark);
      };
      mark(node.initializer);
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      !inClassName.has(node)
    ) {
      for (const c of conflictsIn(utilities(node.text))) at(node, c);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('responsive utilities', () => {
  it('flags a base utility overridden at a breakpoint on the same element', () => {
    expect(findProblems('x.tsx', '<div className="br:flex br:max-sm:contents" />')).toEqual([
      'x.tsx:1 br:max-sm:contents (display)',
    ]);
    expect(findProblems('x.tsx', '<main className="br:px-4 br:md:px-8" />')).toEqual([
      'x.tsx:1 br:md:px-8 (padding-inline)',
    ]);
    expect(findProblems('x.tsx', "<a className={cn('br:gap-1', on && 'br:md:gap-3')} />")).toEqual([
      'x.tsx:1 br:md:gap-3 (column-gap, row-gap)',
    ]);
    expect(findProblems('x.ts', "const C = 'br:m-2 br:lg:mx-4';")).toEqual([
      'x.ts:1 br:lg:mx-4 (margin-inline)',
    ]);
  });

  it('flags breakpoint utilities passed into a component', () => {
    expect(findProblems('x.tsx', '<IconButton className="br:md:hidden" />')).toEqual([
      'x.tsx:1 br:md:hidden passed to <IconButton>',
    ]);
    expect(findProblems('x.tsx', '<Dialog.Content className="br:fixed br:md:hidden" />')).toEqual(
      [],
    );
  });

  it('accepts breakpoint-exclusive pairs', () => {
    expect(findProblems('x.tsx', '<div className="br:sm:flex br:max-sm:contents" />')).toEqual([]);
    expect(findProblems('x.tsx', '<main className="br:max-md:px-4 br:md:px-8 br:py-6" />')).toEqual(
      [],
    );
    expect(findProblems('x.tsx', '<div className="br:md:hidden"><Menu /></div>')).toEqual([]);
  });

  it('finds none in the react, renderer and inertia sources', () => {
    const packages = join(import.meta.dirname, '../..');
    const problems = ['react', 'renderer', 'inertia'].flatMap((pkg) =>
      sources(join(packages, pkg, 'src')).flatMap((file) =>
        findProblems(relative(packages, file), readFileSync(file, 'utf8')),
      ),
    );
    expect(problems).toEqual([]);
  });
});
