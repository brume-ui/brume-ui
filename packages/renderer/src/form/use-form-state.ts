import type { FormDef } from '@brume-ui/brume-schema';
import { useRef, useState } from 'react';
import { type FieldErrors, isPathWithin } from './errors';
import { getAt, setAt } from './paths';
import { collectValueFields, validateValue } from './validate';

export interface FormApi {
  /** Changes only on explicit reset, including resets to identical values. */
  readonly resetVersion: number;
  values: Record<string, unknown>;
  dirty: boolean;
  submitting: boolean;
  pendingUploads: number;
  errors: FieldErrors;
  getValue(path: string): unknown;
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

export function useFormState(form: FormDef, initial: Record<string, unknown>): FormApi {
  const [, refresh] = useState(0);
  // Refs make writes immediately observable by validateAll, including within one event.
  const state = useRef({
    values: initial,
    baseline: initial,
    baselineKey: stable(initial),
    touched: new Set<string>(),
    server: {} as FieldErrors,
    submitting: false,
    pendingUploads: 0,
    resetVersion: 0,
  });
  const current = state.current;
  const fields = () => collectValueFields(form.nodes, current.values);
  const notify = () => refresh((version) => version + 1);
  const errors = (): FieldErrors => {
    const client = Object.fromEntries(
      fields().flatMap(({ path, def }) => {
        const message = current.touched.has(path)
          ? validateValue(def, getAt(current.values, path))
          : null;
        return message === null ? [] : [[path, [message]]];
      }),
    );
    return { ...client, ...current.server };
  };
  return {
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
    setValue(path, value) {
      // Run the path guard even on a no-op write.
      const next = setAt(current.values, path, value);
      if (stable(getAt(current.values, path)) === stable(value)) return;
      current.values = next;
      current.server = Object.fromEntries(
        Object.entries(current.server).filter(
          ([key]) => !isPathWithin(key, path) && !isPathWithin(path, key),
        ),
      );
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
