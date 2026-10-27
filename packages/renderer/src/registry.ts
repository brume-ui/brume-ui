import type { ComponentType } from 'react';

export type RegistryMode = 'precompiled' | 'vite';

export interface ComponentRegistry {
  mode: RegistryMode;
  // biome-ignore lint/suspicious/noExplicitAny: custom components define their own props
  get(name: string): ComponentType<any> | undefined;
}

export function createRegistry(opts: {
  mode: RegistryMode;
  // biome-ignore lint/suspicious/noExplicitAny: custom components define their own props
  components?: Record<string, ComponentType<any>>;
}): ComponentRegistry {
  const components = opts.components ?? {};
  return {
    mode: opts.mode,
    get: (name) => (Object.hasOwn(components, name) ? components[name] : undefined),
  };
}
