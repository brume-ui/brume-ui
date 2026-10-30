import { createTranslator } from '@brume-ui/brume-react';
import type { FormDef } from '@brume-ui/brume-schema';
import { useRef, useState } from 'react';
import { type FieldErrors, isPathWithin } from './errors';
import { assertSafePath, getAt, setAt } from './paths';
import { findValueFieldOwner } from './traversal';
import { collectValueFields, type ValueField } from './validate';

export interface FormApi {
  /** Full authoritative declarations, including empty row templates. */
  readonly definition: FormDef;
  /** Stable ownership token across API wrappers for this mounted form state. */
  readonly stateId: symbol;
  /** Changes only on explicit reset, including resets to identical values. */
  readonly resetVersion: number;
  values: Record<string, unknown>;
  dirty: boolean;
  submitting: boolean;
  pendingUploads: number;
  errors: FieldErrors;
  getValue(path: string): unknown;
  /** Snapshot metadata from the shared walker; identity may change after any value write. */
  getField(path: string): ValueField | undefined;
  /** Declaration identity plus explicit row origin; used by useFieldConditions. */
  readonly fields: readonly ValueField[];
  moveRow(path: string, from: number, to: number): void;
  removeRow(path: string, index: number): void;
  setValue(path: string, value: unknown): void;
  touch(path: string): void;
  validateAll(): boolean;
  setServerErrors(errors: Record<string, string[]>): void;
  reset(values?: Record<string, unknown>): void;
  trackUpload(): () => void;
  setSubmitting(on: boolean): void;
}

/** JSON values with object keys sorted; array order is significant. */
function stable(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return item;
  });
}

type Translate = ReturnType<typeof createTranslator>;
const defaultTranslate = createTranslator('zh-TW');

export function useFormState(
  form: FormDef,
  initial: Record<string, unknown>,
  t: Translate = defaultTranslate,
): FormApi {
  const [, refresh] = useState(0);
  // Refs make writes immediately observable by validateAll, including within one event.
  const state = useRef({
    stateId: Symbol('form-state'),
    values: initial,
    baseline: initial,
    baselineKey: stable(initial),
    touched: new Set<string>(),
    server: {} as FieldErrors,
    submitting: false,
    pendingUploads: 0,
    resetVersion: 0,
    fieldCache: undefined as
      | undefined
      | {
          values: Record<string, unknown>;
          nodes: FormDef['nodes'];
          t: Translate;
          fields: ValueField[];
        },
  });
  const current = state.current;
  const fields = () => {
    if (
      !current.fieldCache ||
      current.fieldCache.values !== current.values ||
      current.fieldCache.nodes !== form.nodes ||
      current.fieldCache.t !== t
    ) {
      current.fieldCache = {
        values: current.values,
        nodes: form.nodes,
        t,
        fields: collectValueFields(
          form.nodes,
          current.values,
          (def) => `${def.label}${t('common.hasError')}`,
        ),
      };
    }
    return current.fieldCache.fields;
  };
  // Fail configuration even when no consumer reads errors or values yet.
  fields();
  const notify = () => refresh((version) => version + 1);
  const errors = (): FieldErrors => {
    const walked = fields();
    const client = Object.fromEntries(
      walked.flatMap(({ path, active, validationError }) =>
        active && current.touched.has(path) && validationError !== null
          ? [[path, [validationError]]]
          : [],
      ),
    );
    const server = Object.fromEntries(
      Object.entries(current.server).filter(([path]) => {
        const owner = findValueFieldOwner(walked, current.values, path);
        return !owner || owner.active;
      }),
    );
    return { ...client, ...server };
  };
  const editRows = (path: string, from: number, to?: number) => {
    assertSafePath(path);
    const def = fields().find((field) => field.path === path)?.def;
    const rows = getAt(current.values, path);
    if (
      !(def?.type === 'repeater' || (def?.type === 'relation' && def.multiple)) ||
      !Array.isArray(rows)
    )
      throw new Error('Row operation requires a declared row array');
    const valid = (index: number) => Number.isInteger(index) && index >= 0 && index < rows.length;
    if (!valid(from) || (to !== undefined && !valid(to))) throw new Error('Invalid row index');
    if (from === to) return;
    const order = rows.map((_, index) => index);
    order.splice(from, 1);
    if (to !== undefined) order.splice(to, 0, from);
    const positions = new Map(order.map((old, index) => [old, index]));
    const remap = (key: string): string | null => {
      if (!key.startsWith(`${path}.`)) return key;
      const [index, ...tail] = key.slice(path.length + 1).split('.');
      if (!index || !/^(0|[1-9]\d*)$/.test(index) || Number(index) >= rows.length) return key;
      const next = positions.get(Number(index));
      return next === undefined
        ? null
        : `${path}.${next}${tail.length ? `.${tail.join('.')}` : ''}`;
    };
    current.values = setAt(
      current.values,
      path,
      order.map((index) => rows[index]),
    );
    current.touched = new Set(
      [...current.touched].flatMap((key) => {
        const next = remap(key);
        return next === null ? [] : [next];
      }),
    );
    current.server = Object.fromEntries(
      Object.entries(current.server).flatMap(([key, value]) => {
        const next = remap(key);
        return next === null ? [] : [[next, value]];
      }),
    );
    notify();
  };
  return {
    definition: form,
    stateId: current.stateId,
    get values() {
      return current.values;
    },
    get resetVersion() {
      return current.resetVersion;
    },
    get dirty() {
      return stable(current.values) !== current.baselineKey;
    },
    get submitting() {
      return current.submitting;
    },
    get pendingUploads() {
      return current.pendingUploads;
    },
    get errors() {
      return errors();
    },
    getValue: (path) => getAt(current.values, path),
    get fields() {
      return fields();
    },
    getField: (path) => fields().find((field) => field.path === path),
    moveRow(path, from, to) {
      if (!Number.isInteger(to)) throw new Error('Invalid row index');
      editRows(path, from, to);
    },
    removeRow: (path, index) => editRows(path, index),
    setValue(path, value) {
      // Run the path guard even on a no-op write.
      const next = setAt(current.values, path, value);
      if (stable(getAt(current.values, path)) === stable(value)) return;
      const previous = current.values;
      const owners = fields();
      current.server = Object.fromEntries(
        Object.entries(current.server).filter(([key]) => {
          if (isPathWithin(path, key)) return false;
          if (!isPathWithin(key, path)) return true;
          const owner = findValueFieldOwner(owners, previous, key);
          const compare = owner?.path ?? key;
          return stable(getAt(previous, compare)) === stable(getAt(next, compare));
        }),
      );
      current.values = next;
      notify();
    },
    touch(path) {
      current.touched.add(path);
      notify();
    },
    validateAll() {
      for (const { path } of fields()) current.touched.add(path);
      const valid = Object.values(errors()).every((messages) => messages.length === 0);
      notify();
      return valid;
    },
    setServerErrors(server) {
      current.server = Object.fromEntries(
        Object.entries(server).map(([path, messages]) => [path, [...messages]]),
      );
      notify();
    },
    reset(values = current.baseline) {
      current.resetVersion += 1;
      current.values = values;
      current.baseline = values;
      current.baselineKey = stable(values);
      current.touched = new Set();
      current.server = {};
      current.submitting = false;
      notify();
    },
    trackUpload() {
      current.pendingUploads += 1;
      notify();
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        current.pendingUploads -= 1;
        notify();
      };
    },
    setSubmitting(on) {
      current.submitting = on;
      notify();
    },
  };
}
