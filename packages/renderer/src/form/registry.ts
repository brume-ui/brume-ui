import type { FieldDef } from '@brume-ui/brume-schema';
import type { FieldComponent } from './contract';
import { ChoiceField } from './fields/choice';
import { DateField } from './fields/date';
import { HiddenField, ReadOnlyField, SwitchField } from './fields/misc';
import { RelationField } from './fields/relation';
import { TextField } from './fields/text';
import { UploadField } from './fields/upload';

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

for (const type of ['date', 'datetime', 'dateRange', 'datetimeRange'] as const)
  registerBuiltInField(type, DateField);
for (const type of ['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const)
  registerBuiltInField(type, ChoiceField);

registerBuiltInField('upload', UploadField);

registerBuiltInField('relation', RelationField);
