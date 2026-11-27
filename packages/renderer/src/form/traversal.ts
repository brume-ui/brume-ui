import { createTranslator } from '@brume-ui/brume-react';
import type {
  Condition,
  ConditionPath,
  FieldDef,
  FormDef,
  FormNode,
  RowContext,
} from '@brume-ui/brume-schema';
import type { AuthorityValue } from './authority';
import { canonicalizeFieldValue, conditionPaths, evaluateCondition } from './conditions';
import { isPathWithin } from './errors';
import { assertSafePath, getAt, joinPath, setAt } from './paths';
import { repeaterIdentities } from './row-identity';
import { isStructural } from './structural';
import { collectFields, validateField } from './validate';

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

/** A `group` node's condition and the row template the node sits in (like a field at that position). */
interface GroupDeclaration {
  condition: Condition;
  rowTemplate?: string;
  where: string;
}

/** Mirrors `collectFields`' path rules so each group resolves its paths where a field there would. */
function groupDeclarations(nodes: FormNode[], base = '', rowTemplate?: string): GroupDeclaration[] {
  return nodes.flatMap((node): GroupDeclaration[] => {
    switch (node.type) {
      case 'field': {
        const { field } = node;
        if (field.type !== 'repeater' && field.type !== 'relation') return [];
        const path = joinPath(base, field.name);
        const row = field.type === 'repeater' || field.multiple ? `${path}.*` : path;
        return groupDeclarations(
          field.type === 'repeater' ? field.nodes : (field.fields ?? []),
          row,
          row,
        );
      }
      case 'columns':
        return node.columns.flatMap((column) =>
          groupDeclarations(column.children, base, rowTemplate),
        );
      case 'embeds':
        return groupDeclarations(node.children, joinPath(base, node.name), rowTemplate);
      case 'divider':
      case 'html':
      case 'button':
        return [];
      case 'group':
        return [
          { condition: node.showWhen, rowTemplate, where: `group in ${base || 'the form'}` },
          ...groupDeclarations(node.children, base, rowTemplate),
        ];
      default:
        return groupDeclarations(node.children, base, rowTemplate);
    }
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

/** Direct children of a `table` repeater must be plain field columns. */
function checkTableLayout(entry: Declaration): void {
  const { def } = entry;
  if (def.type !== 'repeater' || def.layout !== 'table') return;
  const where = `Repeater "${entry.path}" has layout "table"`;
  for (const node of def.nodes) {
    if (node.type !== 'field')
      throw new Error(`${where}: every direct child must be a field, found a ${node.type} node`);
    const { field } = node;
    if (
      ['repeater', 'relation', 'upload', 'richText', 'keyValue', 'list', 'tree', 'custom'].includes(
        field.type,
      )
    )
      throw new Error(
        `${where}: field "${field.name}" (type ${field.type}) cannot be a table column`,
      );
    if (field.type === 'multipleSelect' && 'appearance' in field && field.appearance === 'listbox')
      throw new Error(
        `${where}: field "${field.name}" (multipleSelect with appearance listbox) cannot be a table column`,
      );
  }
}

/** The comparison leaves of a condition (all/any/not are descended). */
function conditionLeaves(
  condition: Condition,
): Array<Exclude<Condition, { conditions: unknown } | { op: 'not' }>> {
  if ('conditions' in condition) return condition.conditions.flatMap(conditionLeaves);
  if (condition.op === 'not') return conditionLeaves(condition.condition);
  return [condition];
}

function checkDeclarations(entries: Declaration[], groups: GroupDeclaration[] = []): void {
  const edges = new Map<string, Set<string>>();
  const resolve = (field: ConditionPath, entry: Declaration, wildcard = false) => {
    const path = declarationPath(field, entry, wildcard);
    const target = entries.find((candidate) => matches(candidate.path, path));
    if (!target) throw new Error(`Unknown declaration path: ${path} (from ${entry.path})`);
    return target;
  };
  // A group's condition is declared like a field's at that position: its paths must exist and
  // keyValue/list/tree targets only take `empty`.
  // keyValue, list and tree values have no scalar to compare: only `empty` is meaningful.
  const checkOperands = (condition: Condition, entry: Declaration) => {
    for (const leaf of conditionLeaves(condition)) {
      if (leaf.op === 'empty') continue;
      const target = resolve(leaf.field, entry);
      if (isStructural(target.def))
        throw new Error(
          `Condition on ${target.def.type} "${target.path}" only supports "empty", not "${leaf.op}" (from ${entry.path})`,
        );
    }
  };
  for (const entry of entries) checkTableLayout(entry);
  for (const group of groups) {
    const at: Declaration = {
      path: group.where,
      def: { type: 'hidden', name: group.where, label: group.where },
      rowTemplate: group.rowTemplate,
      rows: [],
      parents: [],
      uploads: [],
      order: [],
    };
    for (const path of conditionPaths(group.condition)) resolve(path, at);
    checkOperands(group.condition, at);
  }
  for (const entry of entries) {
    if (
      entry.def.type === 'list' &&
      entry.def.min !== undefined &&
      entry.def.max !== undefined &&
      entry.def.min > entry.def.max
    )
      throw new Error(
        `List "${entry.path}": min (${entry.def.min}) must not exceed max (${entry.def.max})`,
      );
    const dependencies = new Set(entry.parents);
    for (const condition of [entry.def.showWhen, entry.def.enableWhen]) {
      if (!condition) continue;
      for (const path of conditionPaths(condition)) dependencies.add(resolve(path, entry).path);
      checkOperands(condition, entry);
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
  checkDeclarations(declarations(nodes), groupDeclarations(nodes));
}

export interface ValueField {
  originalDef?: FieldDef;
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
  /** For two-bound fields: the bound `validationError` belongs to (its error path is `path.bound`). */
  validationBound?: 'start' | 'end';
  /** For keyValue/list: every error with its path relative to the field; see FieldValidationError. */
  validationItems?: Array<{ suffix: string; message: string }>;
  /** Effective controller value uses stored/default authority while inactive. */
  authorityRequired: boolean;
  effectiveValue: unknown;
  effectiveKnown: boolean;
  ready: boolean;
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

const defaultTranslate = createTranslator('zh-TW');
const defaultError = (def: FieldDef) => `${def.label}${defaultTranslate('common.hasError')}`;

/** One current-value walker for renderer, validation, async row consumers and error ownership. */
export function collectValueFields(
  nodes: FormNode[],
  values: Record<string, unknown>,
  invalidMessage: (def: FieldDef) => string = defaultError,
  rowFields: FormDef['rowFields'] = [],
  authority?: (field: ValueField) => AuthorityValue,
  t: ReturnType<typeof createTranslator> = defaultTranslate,
): ValueField[] {
  const entries = declarations(nodes);
  checkDeclarations(entries, groupDeclarations(nodes));
  const rowKey = (row: RowContext) =>
    JSON.stringify(row.map(({ path, key, id }) => [path, key, id ?? null]));
  const resolved = new Map<string, NonNullable<FormDef['rowFields']>[number]['fields']>();
  for (const entry of rowFields) {
    if (!entry.row.length) throw new Error('Resolved row fields require a row context');
    for (const row of entry.row) {
      assertSafePath(row.path, true);
      if (!row.key) throw new Error('Resolved row requires stable identity');
    }
    for (const path of Object.keys(entry.fields)) assertSafePath(path);
    const key = rowKey(entry.row);
    if (resolved.has(key)) throw new Error('Duplicate resolved row context');
    resolved.set(key, entry.fields);
  }
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
      const relative = entry.rowTemplate
        ? entry.path.slice(entry.rowTemplate.length + 1)
        : undefined;
      const override = relative ? resolved.get(rowKey(rowContext))?.[relative] : undefined;
      const def = override ? { ...entry.def, ...override } : entry.def;
      const value = getAt(values, path);
      const canonical = canonicalizeFieldValue(def, value);
      const noneditable =
        def.readOnly ||
        def.disabled ||
        def.type === 'display' ||
        def.type === 'hidden' ||
        (def.type === 'custom' && def.displayOnly);
      const count = Array.isArray(value) ? value.length : 0;
      const countInvalid =
        def.type === 'repeater' &&
        ((def.min !== undefined && count < def.min) || (def.max !== undefined && count > def.max));
      const builtIn = validateField(def, value, t);
      const validationError =
        builtIn?.message ??
        (!noneditable && countInvalid ? invalidMessage(def) : null) ??
        (!noneditable && def.type === 'repeater' && !repeaterIdentities(value, def.mode)
          ? invalidMessage(def)
          : null) ??
        (!noneditable && !canonical.valid ? invalidMessage(def) : null);
      const field: ValueField = {
        originalDef: entry.def,
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
        validationBound: builtIn?.bound,
        validationItems: builtIn?.items,
        authorityRequired: entry.parents.some((path) => {
          const parent = entries.find((entry) => entry.path === path)?.def;
          return parent?.type === 'relation' && parent.hydrateAuthority === true;
        }),
        effectiveValue: value,
        effectiveKnown: true,
        ready: true,
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
  const completed = new Set<string>();
  const parentsByPath = new Map(pending.map(({ field, parents }) => [field.path, parents]));
  // Conditions and readiness must select the same owner: a known inactive collection
  // supersedes draft descendants, including rows absent from its authoritative snapshot.
  const effective = (path: string): AuthorityValue => {
    const ancestor = pending.find(
      ({ field: candidate }) =>
        (candidate.def.type === 'repeater' || candidate.def.type === 'relation') &&
        path.startsWith(`${candidate.path}.`) &&
        !resolve(candidate).active,
    )?.field;
    if (ancestor)
      return {
        known: ancestor.effectiveKnown,
        value: getAt(ancestor.effectiveValue, path.slice(ancestor.path.length + 1)),
      };
    const target = byPath.get(path);
    return target
      ? { known: resolve(target).effectiveKnown, value: target.effectiveValue }
      : { known: true, value: undefined };
  };
  const resolve = (field: ValueField): ValueField => {
    if (completed.has(field.path)) return field;
    const parentFields = (parentsByPath.get(field.path) ?? []).flatMap((path) => {
      const parent = byPath.get(path);
      return parent ? [resolve(parent)] : [];
    });
    const dependencies = [field.def.showWhen, field.def.enableWhen].flatMap((condition) =>
      condition
        ? conditionPaths(condition).map((dependency) => {
            const path =
              dependency.scope === 'root'
                ? dependency.path
                : joinPath(field.rowPath ?? '', dependency.path);
            return effective(path);
          })
        : [],
    );
    field.ready =
      parentFields.some(
        (parent) =>
          (parent.def.type === 'repeater' || parent.def.type === 'relation') &&
          !parent.active &&
          parent.effectiveKnown,
      ) ||
      (parentFields.every((parent) => parent.ready) &&
        dependencies.every((target) => target.known));
    const options = {
      getField: (path: string) =>
        byPath.get(path)?.def ?? entries.find((entry) => matches(entry.path, path))?.def,
      getValue: (path: string) => effective(path).value,
      isInvalid: (path: string) => {
        const target = byPath.get(path);
        return !!target && target.active && target.validationError !== null;
      },
    };
    const evaluate = (condition: Condition | undefined) =>
      !condition || !field.ready || evaluateCondition(condition, values, field.rowPath, options);
    field.visible = parentFields.every((parent) => parent.visible) && evaluate(field.def.showWhen);
    field.enabled =
      field.ready &&
      parentFields.every((parent) => parent.enabled) &&
      !field.def.disabled &&
      evaluate(field.def.enableWhen);
    field.readOnly = !!field.def.readOnly || parentFields.some((parent) => parent.readOnly);
    field.active =
      field.visible &&
      field.enabled &&
      !field.readOnly &&
      field.def.type !== 'display' &&
      !(field.def.type === 'custom' && field.def.displayOnly);
    const stored = authority?.(field) ?? { known: true, value: getAt(values, field.path) };
    field.effectiveKnown = field.active || stored.known;
    field.effectiveValue = field.active ? getAt(values, field.path) : stored.value;
    completed.add(field.path);
    if (field.active && (field.def.type === 'repeater' || field.def.type === 'relation')) {
      let projected = { value: getAt(values, field.path) };
      for (const { field: child, parents } of pending) {
        if (parents.at(-1) !== field.path) continue;
        resolve(child);
        projected = setAt(
          projected,
          `value.${child.path.slice(field.path.length + 1)}`,
          child.effectiveValue,
        );
        field.effectiveKnown &&= child.effectiveKnown;
      }
      field.effectiveValue = projected.value;
    }
    return field;
  };
  for (const { field } of pending) resolve(field);
  // Distinct compares each declared child with its field-specific canonical value.
  // Empty/invalid/inactive values are handled by their own validation and never coerce IDs.
  for (const { field: container } of pending) {
    if (container.def.type !== 'repeater' || !container.active) continue;
    const rows = getAt(values, container.path);
    if (!Array.isArray(rows)) continue;
    for (const child of container.def.distinct ?? []) {
      assertSafePath(child);
      const groups = new Map<string, ValueField[]>();
      rows.forEach((_row, index) => {
        const field = byPath.get(`${container.path}.${index}.${child}`);
        if (!field?.active) return;
        const canonical = canonicalizeFieldValue(field.def, getAt(values, field.path));
        if (!canonical.valid || canonical.value == null || canonical.value === '') return;
        const key = JSON.stringify(canonical.value);
        const group = groups.get(key) ?? [];
        group.push(field);
        groups.set(key, group);
      });
      for (const group of groups.values())
        if (group.length > 1)
          for (const field of group) field.validationError ??= invalidMessage(field.def);
    }
  }
  // A controller's raw failure always makes direct dependents conservative; hidden invalid fields
  // keep their draft and do not independently block until they become editable again.
  return pending.map(({ field }) => field);
}

/** The client errors of one field as `[path, messages]` pairs, relative to nothing (absolute). */
export function fieldClientErrors(field: ValueField): Array<[string, string[]]> {
  if (field.validationError === null) return [];
  if (field.validationItems)
    return field.validationItems.map(({ suffix, message }) => [
      suffix === '' ? field.path : `${field.path}.${suffix}`,
      [message],
    ]);
  return [
    [
      field.validationBound ? `${field.path}.${field.validationBound}` : field.path,
      [field.validationError],
    ],
  ];
}

/** Error ownership stops at undeclared/missing row boundaries instead of claiming every prefix.
 * Other controls, including opaque custom composites, retain their own relative error paths.
 */
export function findValueFieldOwner(
  fields: readonly ValueField[],
  values: Record<string, unknown>,
  path: string,
): ValueField | undefined {
  const owner = fields
    .filter((field) => isPathWithin(path, field.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!owner || owner.path === path) return owner;
  const { def } = owner;
  if (def.type !== 'repeater' && def.type !== 'relation' && def.type !== 'upload') return owner;
  // A declared embeds/extra group is also known when it has current expanded descendants.
  if (fields.some((field) => isPathWithin(field.path, path))) return owner;
  const parts = path.slice(owner.path.length + 1).split('.');
  let item = getAt(values, owner.path);
  if (def.type === 'repeater' || def.multiple) {
    const index = parts.shift();
    if (!index || !/^(0|[1-9]\d*)$/.test(index) || !Array.isArray(item)) return undefined;
    item = getAt(item, index);
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const suffix = parts.join('.');
  // Whole existing rows/items and their declared wire identity are owned by the container.
  // Arbitrary extra keys, including keys present only in untrusted values, are not declarations.
  const metadata =
    def.type === 'repeater'
      ? ['_brume', '_brume.key', '_brume.id']
      : def.type === 'relation'
        ? ['id']
        : ['path', 'token', 'url', 'name', 'size'];
  return suffix === '' || metadata.includes(suffix) ? owner : undefined;
}
