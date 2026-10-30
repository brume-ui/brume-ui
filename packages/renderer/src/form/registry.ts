import type { FieldDef } from '@brume-ui/brume-schema';
import type { FieldComponent } from './contract';

const builtIns = new Map<string, FieldComponent>();

export function resolveField(type: string): FieldComponent | undefined {
  return builtIns.get(type);
}

/** Internal registration, populated by the built-in field modules. */
export function registerBuiltInField(type: FieldDef['type'], component: FieldComponent): void {
  builtIns.set(type, component);
}
