import type { GridRow } from '@brume-ui/brume-schema';
import type { ComponentType } from 'react';
import type { FieldComponent } from './form/contract';

export interface DisplayProps {
  value: unknown;
  row: GridRow;
  column: string;
  props: Record<string, unknown>;
}

export interface FieldRegistration {
  component: FieldComponent;
  inlineEditable: boolean;
}

export type RegistryMode = 'precompiled' | 'vite';

export interface ComponentRegistry {
  mode: RegistryMode;
  getField(name: string): FieldRegistration | undefined;
  getDisplay(name: string): ComponentType<DisplayProps> | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: custom components define their own props
  get(name: string): ComponentType<any> | undefined;
}

export function createRegistry(opts: {
  mode: RegistryMode;
  // biome-ignore lint/suspicious/noExplicitAny: custom components define their own props
  components?: Record<string, ComponentType<any>>;
  fields?: Record<string, FieldComponent | { component: FieldComponent; inlineEditable?: boolean }>;
  displays?: Record<string, ComponentType<DisplayProps>>;
}): ComponentRegistry {
  const components = opts.components ?? {};
  const fields = new Map<string, FieldRegistration>();
  for (const [name, entry] of Object.entries(opts.fields ?? {})) {
    // memo/forwardRef are component objects too; only an own component property is metadata.
    const metadata = Object.hasOwn(entry, 'component')
      ? (entry as { component: FieldComponent; inlineEditable?: boolean })
      : undefined;
    fields.set(name, {
      component: metadata ? metadata.component : (entry as FieldComponent),
      inlineEditable: metadata?.inlineEditable === true,
    });
  }
  const displays = opts.displays ?? {};
  return {
    getField: (name) => fields.get(name),
    getDisplay: (name) => (Object.hasOwn(displays, name) ? displays[name] : undefined),
    mode: opts.mode,
    get: (name) => (Object.hasOwn(components, name) ? components[name] : undefined),
  };
}
