import { type ComboboxLoader, useBrume } from '@brume-ui/brume-react';
import {
  OPTIONS_PARAMS,
  type OptionAncestorSourceContext,
  type OptionItem,
  type OptionsResponse,
  type RemoteOptions,
  type RowContext,
} from '@brume-ui/brume-schema';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { canonicalizeFieldValue, resolveConditionPath } from './conditions';
import { fieldOwnershipKey } from './field-ownership';
import { collectionRowContexts, rowLifetime } from './row-lifetime';
import type { ValueField } from './traversal';
import type { FormApi } from './use-form-state';

interface RemoteOptionsBase {
  rowContext?: RowContext;
  /** Inactive sources abort existing requests and do not fetch. */
  active?: boolean;
}
export interface FormRemoteOptionsConfig extends RemoteOptionsBase {
  remote?: RemoteOptions;
  form: FormApi;
  path: string;
}
export interface StandaloneRemoteOptionsConfig extends RemoteOptionsBase {
  /** Grid declarations provide an already-resolved endpoint, without Form dependency paths. */
  remote?: { url: string; dependsOn?: never };
  form?: never;
  path?: never;
  ownerKey: string;
  /** Only server-declared source context; caller supplies canonical values, never arbitrary URL state. */
  resolvedDepends?: Record<string, unknown>;
  /** Changes on explicit clear/reset/invalidation of this declaration. */
  resetKey?: unknown;
}
export type RemoteOptionsConfig = FormRemoteOptionsConfig | StandaloneRemoteOptionsConfig;
export type RemoteOptionsChannel = 'search' | 'labels';
export interface RemoteOptionsSource {
  /** Opaque identity for primitive cache ownership. */
  scopeKey: object;
  enabled: boolean;
  request<T extends OptionsResponse = OptionsResponse>(
    query: OptionsQuery,
    channel?: RemoteOptionsChannel,
  ): Promise<T>;
  load: ComboboxLoader;
  resolveLabels(values: string[]): Promise<OptionItem[]>;
  cancel(channel: RemoteOptionsChannel): void;
}
export interface OptionsQuery {
  q?: string;
  page?: number;
  perPage?: number;
  section?: string;
  values?: string[];
}
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

function resolveDependencies(
  remote: RemoteOptions | undefined,
  form: FormApi,
  field: ValueField | undefined,
) {
  const values: Record<string, unknown> = {};
  const contexts: Record<string, RowContext> = {};
  const ownership: Record<string, unknown> = {};
  const chains: RowContext[] = [];
  for (const [name, dependency] of Object.entries(remote?.dependsOn ?? {})) {
    if (!field) {
      values[name] = null;
      continue;
    }
    const target = resolveConditionPath(dependency, field.rowPath);
    const declared = form.getField(target);
    const canonical = canonicalizeFieldValue(declared?.def, form.getValue(target));
    values[name] = canonical.valid ? (canonical.value ?? null) : null;
    if (declared?.rowContext.length) contexts[name] = declared.rowContext;
    ownership[name] = fieldOwnershipKey(form, target, declared?.rowContext);
    if (declared) chains.push(declared.rowContext);
    if (declared?.def.type === 'repeater' || declared?.def.type === 'relation') {
      const descendants = form.fields.filter(
        (candidate) => candidate.path === target || candidate.path.startsWith(`${target}.`),
      );
      const descendantChains = descendants.flatMap((candidate) => [
        candidate.rowContext,
        ...collectionRowContexts(candidate, form.getValue(candidate.path)),
      ]);
      chains.push(...descendantChains);
      ownership[name] = [
        ownership[name],
        descendantChains.map((chain) => [chain, rowLifetime(form, chain)]),
      ];
    }
  }
  return { values, contexts, ownership, chains };
}

/** Collect by declaration AND owner instance; the same template can occur in many outer rows. */
function resolveAncestorSources(
  form: FormApi,
  field: ValueField | undefined,
  chains: RowContext[],
) {
  const sources = new Map<string, OptionAncestorSourceContext>();
  const ownership: Record<string, unknown> = {};
  const visiting = new Set<string>();
  let valid = true;
  const collect = (chain: RowContext) => {
    for (const [index, row] of chain.entries()) {
      const prefix = chain.slice(0, index);
      const container = form.fields.find(
        (candidate) =>
          candidate.templatePath === row.path &&
          stableJson(candidate.rowContext) === stableJson(prefix),
      );
      if (!container) {
        valid = false;
        continue;
      }
      if (container.def.type !== 'relation') continue;
      const key = stableJson([container.templatePath, prefix]);
      if (visiting.has(key)) {
        valid = false;
        continue;
      }
      if (sources.has(key)) continue;
      if (sources.size + visiting.size >= 100) {
        valid = false;
        continue;
      }
      visiting.add(key);
      const dependencies = resolveDependencies(container.def.remote, form, container);
      collect(prefix);
      for (const target of dependencies.chains) collect(target);
      visiting.delete(key);
      ownership[key] = [fieldOwnershipKey(form, container.path, prefix), dependencies.ownership];
      sources.set(key, {
        path: container.templatePath,
        rowContext: prefix,
        depends: dependencies.values,
        ...(Object.keys(dependencies.contexts).length
          ? { dependencyContexts: dependencies.contexts }
          : {}),
      });
    }
  };
  collect(field?.rowContext ?? []);
  for (const target of chains) collect(target);
  return {
    values: [...sources.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
    ownership,
    valid,
  };
}

/** Adapter-only request layer shared by choices and picker. Search and hydration fence separately. */
export function useRemoteOptions(config: RemoteOptionsConfig): RemoteOptionsSource {
  const { remote, rowContext, active = true } = config;
  const { adapter } = useBrume();
  const form = config.form;
  const field = form?.getField(config.path);
  const localOwner = useRef(Symbol('remote-source'));
  const dependencies = form
    ? resolveDependencies(remote, form, field)
    : { values: config.resolvedDepends ?? {}, contexts: {}, ownership: {}, chains: [] };
  const dependsKey = stableJson(dependencies.values);
  const dependencyContextsKey = stableJson(dependencies.contexts);
  const dependencyOwnershipKey = stableJson(dependencies.ownership);
  const ancestors = form
    ? resolveAncestorSources(form, field, dependencies.chains)
    : { values: [], ownership: {}, valid: true };
  const ancestorSourcesKey = stableJson(ancestors.values);
  const ancestorOwnershipKey = stableJson(ancestors.ownership);
  const contextKey = stableJson(rowContext ?? field?.rowContext ?? []);
  const lifetime = form ? rowLifetime(form, rowContext ?? field?.rowContext) : 0;
  const endpoint = remote?.url;
  const owner = form ? (field?.templatePath ?? config.path) : config.ownerKey;
  const stateId = form?.stateId ?? localOwner.current;
  const resetKey = form ? form.resetVersion : config.resetKey;
  const enabled =
    active &&
    ancestors.valid &&
    !!endpoint &&
    (!form || (!!field && stableJson(field.rowContext) === contextKey));
  const scope = useMemo(
    () => ({
      endpoint,
      dependsKey,
      dependencyContextsKey,
      dependencyOwnershipKey,
      ancestorSourcesKey,
      ancestorOwnershipKey,
      contextKey,
      enabled,
      adapter,
      stateId,
      resetKey,
      owner,
      lifetime,
      alive: true,
      channels: new Map<RemoteOptionsChannel, AbortController>(),
    }),
    [
      endpoint,
      dependsKey,
      dependencyContextsKey,
      dependencyOwnershipKey,
      ancestorSourcesKey,
      ancestorOwnershipKey,
      contextKey,
      enabled,
      adapter,
      stateId,
      resetKey,
      owner,
      lifetime,
    ],
  );
  const latest = useRef(scope);
  latest.current = scope;
  // Layout setup precedes child hydration passive effects, including StrictMode replay.
  // True unmount still marks this scope dead and aborts both channels immediately.
  useLayoutEffect(() => {
    scope.alive = true;
    return () => {
      scope.alive = false;
      for (const controller of scope.channels.values()) controller.abort();
    };
  }, [scope]);
  const cancel = useCallback(
    (channel: RemoteOptionsChannel) => {
      scope.channels.get(channel)?.abort();
      scope.channels.delete(channel);
    },
    [scope],
  );
  const request = useCallback(
    async <T extends OptionsResponse = OptionsResponse>(
      query: OptionsQuery,
      channel: RemoteOptionsChannel = query.values ? 'labels' : 'search',
    ): Promise<T> => {
      const currentOwner = () => {
        if (!scope.enabled || !scope.alive || latest.current !== scope) return false;
        if (!form) return true;
        if (form.stateId !== scope.stateId || form.resetVersion !== scope.resetKey) return false;
        // Form writes are synchronous, even before React commits. Follow the stable owner after
        // movement; never interpret its old numeric path as the current row's ownership.
        const currentField =
          scope.contextKey === '[]'
            ? form.getField(config.path)
            : form.fields.find(
                (item) =>
                  item.templatePath === scope.owner &&
                  stableJson(item.rowContext) === scope.contextKey,
              );
        const currentDependencies = resolveDependencies(remote, form, currentField);
        const currentAncestors = resolveAncestorSources(
          form,
          currentField,
          currentDependencies.chains,
        );
        return (
          !!currentField &&
          currentField.templatePath === scope.owner &&
          rowLifetime(form, currentField.rowContext) === scope.lifetime &&
          stableJson(currentDependencies.values) === scope.dependsKey &&
          stableJson(currentDependencies.contexts) === scope.dependencyContextsKey &&
          stableJson(currentDependencies.ownership) === scope.dependencyOwnershipKey &&
          currentAncestors.valid &&
          stableJson(currentAncestors.values) === scope.ancestorSourcesKey &&
          stableJson(currentAncestors.ownership) === scope.ancestorOwnershipKey
        );
      };
      if (!currentOwner()) throw new Error('Obsolete options scope');
      cancel(channel);
      const controller = new AbortController();
      scope.channels.set(channel, controller);
      const params: Record<string, string | string[]> = {
        [OPTIONS_PARAMS.depends]: scope.dependsKey,
      };
      if (scope.ancestorSourcesKey !== '[]')
        params[OPTIONS_PARAMS.ancestorSources] = scope.ancestorSourcesKey;
      if (scope.dependencyContextsKey !== '{}')
        params[OPTIONS_PARAMS.dependencyContexts] = scope.dependencyContextsKey;
      if (scope.contextKey !== '[]') params[OPTIONS_PARAMS.rowContext] = scope.contextKey;
      if (query.values) params.value = query.values; // adapter encodes arrays as value[], not value[][]
      if (query.q !== undefined) params[OPTIONS_PARAMS.q] = query.q;
      if (query.page !== undefined) params[OPTIONS_PARAMS.page] = String(query.page);
      if (query.perPage !== undefined) params[OPTIONS_PARAMS.perPage] = String(query.perPage);
      if (query.section !== undefined) params[OPTIONS_PARAMS.section] = query.section;
      const response = await adapter.request<T>({
        method: 'get',
        url: scope.endpoint ?? '',
        query: params,
        signal: controller.signal,
      });
      if (
        !currentOwner() ||
        controller.signal.aborted ||
        scope.channels.get(channel) !== controller
      )
        throw new Error('Obsolete options response');
      if (response.status !== 200) throw new Error(`Options request failed (${response.status})`);
      return response.data;
    },
    [adapter, scope, cancel, form, config.path, remote],
  );
  const load = useCallback(
    async ({ q, page }: { q: string; page: number }) => {
      const response = await request({ q, page, perPage: 20 });
      return { options: response.data, hasMore: response.pagination.hasMore };
    },
    [request],
  );
  const resolveLabels = useCallback(
    async (values: string[]) => (await request({ values })).data,
    [request],
  );
  return { scopeKey: scope, request, load, resolveLabels, cancel, enabled };
}
