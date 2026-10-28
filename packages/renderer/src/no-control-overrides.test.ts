import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * brume-react owns the look of its components, and the renderer must not pass `className` to
 * them: a utility from the renderer's stylesheet can lose to (or beat) the component's own
 * utilities depending on stylesheet order. Layout classes go on the renderer's own elements.
 */
const BRUME_REACT = '@brume-ui/brume-react';

/** Each `<BrumeReactComponent className=…>` in `source`, as "file:line <Tag>". */
function findClassNameOverrides(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const named = new Set<string>();
  const namespaces = new Set<string>();
  for (const stmt of file.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (stmt.moduleSpecifier.text !== BRUME_REACT) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) named.add(el.name.text);
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    }
  }

  const isBrumeTag = (tag: ts.JsxTagNameExpression): boolean => {
    if (ts.isIdentifier(tag)) return named.has(tag.text);
    if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)) {
      return namespaces.has(tag.expression.text);
    }
    return false;
  };
  const passesClassName = (attrs: ts.JsxAttributes): boolean =>
    attrs.properties.some((p) => {
      if (ts.isJsxAttribute(p)) return p.name.getText(file) === 'className';
      // `{...{ className }}` / `{...{ className: x }}`
      if (ts.isJsxSpreadAttribute(p) && ts.isObjectLiteralExpression(p.expression)) {
        return p.expression.properties.some((q) => q.name?.getText(file) === 'className');
      }
      return false;
    });

  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isBrumeTag(node.tagName) &&
      passesClassName(node.attributes)
    ) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      hits.push(`${fileName}:${line + 1} <${node.tagName.getText(file)}>`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('no className overrides on brume-react components', () => {
  it('detects named, aliased, namespaced and spread overrides', () => {
    const source = `
      import { Button, Card as Panel } from '@brume-ui/brume-react';
      import * as B from '@brume-ui/brume-react';
      import { Other } from './other';
      export const a = <Button className="x" />;
      export const b = <Panel className={y}>hi</Panel>;
      export const c = <B.Chip className="z" />;
      export const d = <Button {...{ className: 'w' }} />;
      export const ok1 = <Button variant="primary" />;
      export const ok2 = <div className="br:flex"><Other className="fine" /></div>;
    `;
    expect(findClassNameOverrides('fixture.tsx', source)).toEqual([
      'fixture.tsx:5 <Button>',
      'fixture.tsx:6 <Panel>',
      'fixture.tsx:7 <B.Chip>',
      'fixture.tsx:8 <Button>',
    ]);
  });

  it('packages/renderer/src passes no className to brume-react components', () => {
    const root = import.meta.dirname;
    const files = tsxFiles(root);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((path) =>
      findClassNameOverrides(relative(root, path), readFileSync(path, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
