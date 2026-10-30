import type { FieldDef } from '@brume-ui/brume-schema';
import type { FieldComponent } from './contract';

import { HiddenField, ReadOnlyField, SwitchField } from './fields/misc';
import { TextField } from './fields/text';

const builtIns = new Map<string, FieldComponent>();

export function resolveField(type: string): FieldComponent | undefined {
  return builtIns.get(type);
}

/** Internal registration, populated by the built-in field modules. */
export function registerBuiltInField(type: FieldDef['type'], component: FieldComponent): void {
  builtIns.set(type, component);
}

// Value imports keep built-ins reachable when consumers tree-shake the package.
for (const type of [
  'text',
  'textarea',
  'email',
  'url',
  'mobile',
  'password',
  'number',
  'decimal',
  'currency',
] as const) {
  registerBuiltInField(type, TextField);
}
registerBuiltInField('hidden', HiddenField);
registerBuiltInField('display', ReadOnlyField);
registerBuiltInField('switch', SwitchField);
