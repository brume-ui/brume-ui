import { createTranslator } from '@brume-ui/brume-react';
import type {
  Condition,
  ConditionPath,
  FieldDef,
  FormNode,
  RowContext,
} from '@brume-ui/brume-schema';
import { canonicalizeFieldValue, conditionPaths, evaluateCondition } from './conditions';
import { assertSafePath, getAt, joinPath } from './paths';
import { collectFields, validateValue } from './validate';

type RowContainer = { path: string; row: string; kind: 'repeater' | 'relation' };
interface Declaration {
  path: string;
  def: FieldDef;
  rowTemplate?: string;
  rows: RowContainer[];
  parents: string[];
  uploads: string[];
  order: Array<number | string>;
}

/** The declaration pass visits empty row templates too; layouts do not affect activity. */
function declarations(
  nodes: FormNode[],
  base = '',
  parents: string[] = [],
  rows: RowContainer[] = [],
  uploads: string[] = [],
  parentOrder: Array<number | string> = [],
): Declaration[] {
  return collectFields(nodes, base).flatMap(({ path, def }, index) => {
    const order = [...parentOrder, index];
    assertSafePath(path, true);
    const entry: Declaration = {
      path,
      def,
      rowTemplate: rows.at(-1)?.row,
      rows,
      parents,
      uploads,
      order,
    };
    const ancestors = [...parents, path];
    if (def.type === 'repeater' || def.type === 'relation') {
      const row = def.type === 'repeater' || def.multiple ? `${path}.*` : path;
      return [
        entry,
        ...declarations(
          def.type === 'repeater' ? def.nodes : (def.fields ?? []),
          row,
          ancestors,
          [...rows, { path, row, kind: def.type }],
          uploads,
          row.endsWith('.*') ? [...order, row] : order,
        ),
      ];
    }
    if (def.type === 'upload') {
      const item = def.multiple ? `${path}.*` : path;
      return [
        entry,
        ...declarations(
          (def.extra ?? []).map((field) => ({ type: 'field' as const, field })),
          `${item}.extra`,
          ancestors,
          rows,
          [...uploads, item],
          def.multiple ? [...order, item] : order,
        ),
      ];
    }
    return [entry];
  });
}

function matches(template: string, path: string): boolean {
  const actual = path.split('.');
  const expected = template.split('.');
  return (
    actual.length === expected.length &&
    expected.every(
      (part, i) => part === actual[i] || (part === '*' && /^(?:[0-9]+|\*)$/.test(actual[i] ?? '')),
    )
  );
}

function declarationPath(field: ConditionPath, declaration: Declaration, wildcard = false): string {
  assertSafePath(field.path, wildcard);
  if (field.scope === 'root') return field.path;
  if (!declaration.rowTemplate)
    throw new Error(`Row condition requires a row declaration: ${declaration.path}`);
  return joinPath(declaration.rowTemplate, field.path);
}

function checkDeclarations(entries: Declaration[]): void {
  const edges = new Map<string, Set<string>>();
  const resolve = (field: ConditionPath, entry: Declaration, wildcard = false) => {
    const path = declarationPath(field, entry, wildcard);
    const target = entries.find((candidate) => matches(candidate.path, path));
    if (!target) throw new Error(`Unknown declaration path: ${path} (from ${entry.path})`);
    return target.path;
  };
  for (const entry of entries) {
    const dependencies = new Set(entry.parents);
    for (const condition of [entry.def.showWhen, entry.def.enableWhen]) {
      if (condition)
        for (const path of conditionPaths(condition)) dependencies.add(resolve(path, entry));
    }
    edges.set(entry.path, dependencies);
    if ('remote' in entry.def)
      for (const path of Object.values(entry.def.remote?.dependsOn ?? {})) resolve(path, entry);
    if ('excludeSelectedIn' in entry.def)
      for (const path of entry.def.excludeSelectedIn ?? []) resolve(path, entry, true);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (path: string) => {
    if (visiting.has(path)) throw new Error(`Activity cycle at: ${path}`);
    if (visited.has(path)) return;
    visiting.add(path);
    for (const dependency of edges.get(path) ?? []) visit(dependency);
    visiting.delete(path);
    visited.add(path);
  };
  for (const path of edges.keys()) visit(path);
}

/** Throws for unsafe/unknown dependency paths and activity cycles, independent of current values. */
export function validateConditionDeclarations(nodes: FormNode[]): void {
  checkDeclarations(declarations(nodes));
}

export interface ValueField {
  path: string;
  def: FieldDef;
  /** Canonical declaration path; '*' occurs only at declared array boundaries. */
  templatePath: string;
  /** Nearest explicit repeater row or selected-item extras origin, in current numeric paths. */
  rowPath?: string;
  /** Stable outer-to-inner identity chain. Missing metadata is never replaced by an index key. */
  rowContext: RowContext;
  visible: boolean;
  enabled: boolean;
  readOnly: boolean;
  /** Editable activity, including inherited parent state; literal hidden retains its old semantics. */
  active: boolean;
  validationError: string | null;
}

/** Expand only declared array boundaries; never infer a row from a numeric field name. */
function expand(template: string, values: Record<string, unknown>): string[] {
  let paths = [''];
  for (const part of template.split('.')) {
    paths = paths.flatMap((base) => {
      if (part !== '*') return [joinPath(base, part)];
      const array = getAt(values, base);
      return Array.isArray(array) ? array.map((_, index) => joinPath(base, String(index))) : [];
    });
  }
  return paths;
}

const defaultError = (def: FieldDef) =>
  `${def.label}${createTranslator('zh-TW')('common.hasError')}`;

/** One current-value walker for renderer, validation, async row consumers and error ownership. */
export function collectValueFields(
  nodes: FormNode[],
  values: Record<string, unknown>,
  invalidMessage: (def: FieldDef) => string = defaultError,
): ValueField[] {
  const entries = declarations(nodes);
  checkDeclarations(entries);
  const pending = entries.flatMap((entry) =>
    expand(entry.path, values).flatMap((path) => {
      // Every prefix has the same wildcard positions as its descendant declaration.
      const concrete = (template: string) =>
        template
          .split('.')
          .map((part, index) => (part === '*' ? path.split('.')[index] : part))
          .join('.');
      const rowContext: RowContext = [];
      for (const row of entry.rows) {
        const value = getAt(values, concrete(row.row));
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
        const identity = row.kind === 'repeater' ? getAt(value, '_brume') : undefined;
        const key = row.kind === 'relation' ? getAt(value, 'id') : getAt(identity, 'key');
        const id = row.kind === 'relation' ? getAt(value, 'id') : getAt(identity, 'id');
        if (typeof key === 'string' && key)
          rowContext.push({ path: row.path, key, ...(typeof id === 'string' && id ? { id } : {}) });
      }
      for (const template of entry.uploads) {
        const item = getAt(values, concrete(template));
        if (
          !item ||
          typeof item !== 'object' ||
          (!Object.hasOwn(item, 'path') && !Object.hasOwn(item, 'token'))
        )
          return [];
      }
      const def = entry.def;
      const value = getAt(values, path);
      const canonical = canonicalizeFieldValue(def, value);
      const noneditable =
        def.readOnly ||
        def.disabled ||
        def.type === 'display' ||
        def.type === 'hidden' ||
        (def.type === 'custom' && def.displayOnly);
      const validationError =
        validateValue(def, value) ??
        (!noneditable && !canonical.valid ? invalidMessage(def) : null);
      const field: ValueField = {
        path,
        def,
        templatePath: entry.path,
        rowPath: entry.rowTemplate ? concrete(entry.rowTemplate) : undefined,
        rowContext,
        visible: true,
        enabled: true,
        readOnly: !!def.readOnly,
        active: true,
        validationError,
      };
      return [
        {
          field,
          parents: entry.parents.map(concrete),
          order: entry.order.map((part) =>
            typeof part === 'number' ? part : Number(concrete(part).split('.').at(-1)),
          ),
        },
      ];
    }),
  );
  // Interleave declaration order with explicit array indexes so each row is walked in full.
  pending.sort((a, b) => {
    for (let index = 0; index < Math.max(a.order.length, b.order.length); index++) {
      const difference = (a.order[index] ?? -1) - (b.order[index] ?? -1);
      if (difference) return difference;
    }
    return 0;
  });
  const byPath = new Map(pending.map(({ field }) => [field.path, field]));
  const options = {
    getField: (path: string) =>
      byPath.get(path)?.def ?? entries.find((entry) => matches(entry.path, path))?.def,
    isInvalid: (path: string) => byPath.get(path)?.validationError != null,
  };
  // Base validation was computed for every controller before any condition is evaluated.
  for (const { field, parents } of pending) {
    const parentFields = parents.map((path) => byPath.get(path));
    const evaluate = (condition: Condition | undefined) =>
      !condition || evaluateCondition(condition, values, field.rowPath, options);
    field.visible =
      parentFields.every((parent) => parent?.visible !== false) && evaluate(field.def.showWhen);
    field.enabled =
      parentFields.every((parent) => parent?.enabled !== false) &&
      !field.def.disabled &&
      evaluate(field.def.enableWhen);
    field.readOnly = !!field.def.readOnly || parentFields.some((parent) => parent?.readOnly);
    field.active =
      field.visible &&
      field.enabled &&
      !field.readOnly &&
      field.def.type !== 'display' &&
      !(field.def.type === 'custom' && field.def.displayOnly);
  }
  // A controller's raw failure always makes direct dependents conservative; hidden invalid fields
  // keep their draft and do not independently block until they become editable again.
  return pending.map(({ field }) => field);
}
