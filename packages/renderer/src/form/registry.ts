import type { FieldDef } from '@brume-ui/brume-schema';
import type { FieldComponent } from './contract';
import { CaptchaField } from './fields/captcha';
import { ChoiceField } from './fields/choice';
import { ColorField } from './fields/color';
import { DateField } from './fields/date';
import { IconField } from './fields/icon';
import { HiddenField, ReadOnlyField, SwitchField } from './fields/misc';
import { RangeField, SliderField } from './fields/number-like';
import { RelationField } from './fields/relation';
import { RepeaterField } from './fields/repeater';
import { RichTextField } from './fields/rich-text';
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
  'tel',
  'ip',
  'password',
  'number',
  'decimal',
  'currency',
  'rate',
] as const) {
  registerBuiltInField(type, TextField);
}
registerBuiltInField('hidden', HiddenField);
registerBuiltInField('display', ReadOnlyField);
registerBuiltInField('switch', SwitchField);

for (const type of ['date', 'datetime', 'dateRange', 'datetimeRange', 'time', 'timeRange'] as const)
  registerBuiltInField(type, DateField);
for (const type of ['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const)
  registerBuiltInField(type, ChoiceField);

registerBuiltInField('upload', UploadField);
registerBuiltInField('richText', RichTextField);
registerBuiltInField('color', ColorField);
registerBuiltInField('slider', SliderField);
registerBuiltInField('range', RangeField);
registerBuiltInField('icon', IconField);
registerBuiltInField('captcha', CaptchaField);

registerBuiltInField('relation', RelationField);

registerBuiltInField('repeater', RepeaterField);
