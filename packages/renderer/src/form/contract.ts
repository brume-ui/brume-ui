import type { FieldDef, RowContext } from '@brume-ui/brume-schema';
import type { ComponentType } from 'react';
import type { FieldErrors } from './errors';
import type { FormApi } from './use-form-state';

export interface FieldProps<V = unknown, D extends FieldDef = FieldDef> {
  def: D;
  value: V;
  onChange(next: V): void;
  onBlur(): void;
  errors: FieldErrors;
  path: string;
  /** Root control/group ID. Custom composites may mark a child control with
   * data-brume-field-part="relative.path" to route that child's error-summary link. */
  id: string;
  describedBy?: string;
  invalid: boolean;
  readOnly: boolean;
  disabled: boolean;
  form: FormApi;
  uploadUrl?: string;
  rowContext?: RowContext;
}

// The registry deliberately erases individual field value/definition types.
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous field component boundary
export type FieldComponent = ComponentType<FieldProps<any, any>>;
