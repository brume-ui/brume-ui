import type { RelationItem } from '@brume-ui/brume-schema';
import { useLayoutEffect, useRef, useState } from 'react';
import { type FieldErrors, isPathWithin } from './errors';
import { fieldOwnershipKey } from './field-ownership';
import { getAt, setAt } from './paths';
import { bindRowLifetimes, createRowLifetimes, syncRowLifetimes } from './row-lifetime';
import { collectValueFields } from './traversal';
import type { FormApi } from './use-form-state';

interface Config {
  parent: FormApi;
  path: string;
  prefix: string;
  multiple: boolean;
  getDraft(): readonly RelationItem[];
  item: RelationItem;
  onChange(next: RelationItem): void;
  onPending(id: symbol, count: number): void;
}
/** A mounted selection owns all writes, errors, touch state and uploads; root reads stay live. */
export function useRelationDraft(config: Config): FormApi {
  const [, refresh] = useState(0);
  const ownership = {
    ...config,
    parentOwner: fieldOwnershipKey(config.parent, config.path),
    parentState: config.parent.stateId,
    parentReset: config.parent.resetVersion,
  };
  const latest = useRef(ownership);
  latest.current = ownership;
  const createLocal = (epoch: number) => ({
    reader: config.getDraft,
    baseline: config.item,
    id: Symbol('relation-draft'),
    rowLifetimes: createRowLifetimes(),
    alive: true,
    value: config.item,
    accepted: config.item,
    touched: new Set<string>(),
    pending: 0,
    reset: epoch,
    submitting: false,
    server: Object.fromEntries(
      Object.entries(config.parent.errors)
        .filter(([path]) => isPathWithin(path, config.prefix))
        .map(([path, messages]) => [path.slice(config.prefix.length).replace(/^\./, ''), messages]),
    ) as FieldErrors,
  });
  const store = useRef(createLocal(0));
  if (store.current.reader !== config.getDraft)
    store.current = createLocal(store.current.reset + 1);
  const local = store.current;
  // Parent repeaters and selected siblings can move synchronously before this component renders.
  // Follow the captured declaration/lifetime and current selected membership, never an old index.
  const location = () => {
    const c = latest.current;
    if (c.parent.stateId !== c.parentState || c.parent.resetVersion !== c.parentReset)
      return undefined;
    const parent = c.parent.fields.find(
      (field) => fieldOwnershipKey(c.parent, field.path, field.rowContext) === c.parentOwner,
    );
    const index = local.reader().findIndex((item) => item.id === local.value.id);
    if (!parent || index < 0) return undefined;
    return { path: parent.path, prefix: c.multiple ? `${parent.path}.${index}` : parent.path };
  };
  const active = () => local.alive && location() !== undefined;
  if (local.accepted !== config.item) {
    local.accepted = config.item;
    local.value = config.item;
  }
  useLayoutEffect(() => {
    local.alive = true;
    return () => {
      local.alive = false;
      latest.current.onPending(local.id, 0);
    };
  }, [local]);
  const relative = (path: string) => {
    const prefix = location()?.prefix;
    if (prefix === undefined || !isPathWithin(path, prefix))
      throw new Error('Draft write outside selected item');
    return path.slice(prefix.length).replace(/^\./, '');
  };
  const values = () => {
    const c = latest.current;
    const draft = local.reader();
    const current = location();
    return current
      ? setAt(c.parent.values, current.path, c.multiple ? draft : (draft[0] ?? null))
      : c.parent.values;
  };
  const fields = () =>
    location()
      ? collectValueFields(
          latest.current.parent.definition.nodes,
          values(),
          undefined,
          latest.current.parent.definition.rowFields,
        )
      : [];
  syncRowLifetimes(local.rowLifetimes, fields());
  const errors = (): FieldErrors => {
    const prefix = location()?.prefix;
    if (prefix === undefined) return {};
    const result: Record<string, readonly string[]> = {};
    for (const field of fields())
      if (isPathWithin(field.path, prefix)) {
        const key = field.path.slice(prefix.length).replace(/^\./, '');
        if (field.active && local.touched.has(key) && field.validationError)
          result[field.path] = [field.validationError];
      }
    for (const [key, messages] of Object.entries(local.server)) {
      const path = key ? `${prefix}.${key}` : prefix;
      if (fields().find((field) => field.path === path)?.active !== false) result[path] = messages;
    }
    return result;
  };
  const notify = () => {
    if (local.alive) refresh((version) => version + 1);
  };
  const write = (path: string, next: unknown) => {
    if (!active()) return;
    const key = relative(path);
    const value = setAt(local.value, key, next);
    if (value.id !== local.value.id) throw new Error('Draft identity is immutable');
    if (JSON.stringify(value) === JSON.stringify(local.value)) return;
    local.value = value;
    local.server = Object.fromEntries(
      Object.entries(local.server).filter(
        ([error]) => !isPathWithin(error, key) && !isPathWithin(key, error),
      ),
    );
    latest.current.onChange(value);
    syncRowLifetimes(local.rowLifetimes, fields());
    notify();
  };
  const editRows = (path: string, from: number, to?: number) => {
    if (!active()) return;
    const key = relative(path);
    const rows = getAt(local.value, key);
    const field = fields().find((field) => field.path === path)?.def;
    if (
      !Array.isArray(rows) ||
      !(field?.type === 'repeater' || (field?.type === 'relation' && field.multiple))
    )
      throw new Error('Row operation requires a declared row array');
    if (
      ![from, ...(to === undefined ? [] : [to])].every(
        (index) => Number.isInteger(index) && index >= 0 && index < rows.length,
      )
    )
      throw new Error('Invalid row index');
    if (from === to) return;
    const order = rows.map((_, index) => index);
    order.splice(from, 1);
    if (to !== undefined) order.splice(to, 0, from);
    const remap = (error: string) => {
      if (!error.startsWith(`${key}.`)) return error;
      const [index, ...tail] = error.slice(key.length + 1).split('.');
      if (!index || !/^(0|[1-9]\d*)$/.test(index)) return error;
      const next = order.indexOf(Number(index));
      return next < 0 ? null : `${key}.${next}${tail.length ? `.${tail.join('.')}` : ''}`;
    };
    const server = Object.fromEntries(
      Object.entries(local.server).flatMap(([path, messages]) => {
        const next = remap(path);
        return next === null ? [] : [[next, messages]];
      }),
    );
    local.touched = new Set(
      [...local.touched].flatMap((path) => {
        const next = remap(path);
        return next === null ? [] : [next];
      }),
    );
    write(
      path,
      order.map((index) => rows[index]),
    );
    local.server = server;
  };
  const api: FormApi = {
    get definition() {
      return latest.current.parent.definition;
    },
    get stateId() {
      return store.current.id;
    },
    get resetVersion() {
      return latest.current.parent.resetVersion + local.reset;
    },
    get values() {
      return values();
    },
    get fields() {
      return fields();
    },
    get dirty() {
      return JSON.stringify(local.value) !== JSON.stringify(local.baseline);
    },
    get submitting() {
      return local.submitting;
    },
    get pendingUploads() {
      return local.pending;
    },
    get errors() {
      return errors();
    },
    getValue: (path) => getAt(values(), path),
    getField: (path) => fields().find((field) => field.path === path),
    setValue: write,
    touch(path) {
      if (!active()) return;
      local.touched.add(relative(path));
      notify();
    },
    validateAll() {
      if (!active()) return false;
      for (const field of fields())
        if (isPathWithin(field.path, location()?.prefix ?? ''))
          local.touched.add(relative(field.path));
      notify();
      return Object.keys(errors()).length === 0;
    },
    setServerErrors(next) {
      if (!active()) return;
      local.server = Object.fromEntries(
        Object.entries(next).map(([path, messages]) => [relative(path), [...messages]]),
      );
      notify();
    },
    reset(next) {
      if (!active()) return;
      local.reset++;
      syncRowLifetimes(local.rowLifetimes, fields(), true);
      local.touched.clear();
      local.server = {};
      const prefix = location()?.prefix;
      if (prefix !== undefined) write(prefix, next ? getAt(next, prefix) : local.baseline);
    },
    trackUpload() {
      if (!active()) return () => {};
      local.pending++;
      latest.current.onPending(local.id, local.pending);
      notify();
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        local.pending--;
        if (local.alive) {
          latest.current.onPending(local.id, local.pending);
          notify();
        }
      };
    },
    setSubmitting(on) {
      if (!active()) return;
      local.submitting = on;
      notify();
    },
    moveRow: (path, from, to) => editRows(path, from, to),
    removeRow: (path, index) => editRows(path, index),
  };
  return bindRowLifetimes(api, local.rowLifetimes);
}
