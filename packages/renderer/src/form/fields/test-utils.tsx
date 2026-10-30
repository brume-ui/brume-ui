import type { FieldDef } from '@brume-ui/brume-schema';
import type { RenderResult } from '@testing-library/react';
import { useState } from 'react';
import { type Mock, vi } from 'vitest';
import { resolveField } from '../../index';
import { renderWithBrume } from '../../test-utils';
import type { FieldProps } from '../contract';
import { useFormState } from '../use-form-state';

function Harness({
  def,
  extra,
  onChange,
  onBlur,
}: {
  def: FieldDef;
  extra: Partial<FieldProps>;
  onChange: Mock;
  onBlur: Mock;
}) {
  const form = useFormState({ layout: 'stacked', nodes: [] }, {});
  const [value, setValue] = useState(extra.value ?? '');
  const Component = resolveField(def.type);
  return Component ? (
    <Component
      def={def}
      onBlur={onBlur}
      errors={{}}
      path="value"
      id="field-value"
      invalid={false}
      readOnly={false}
      disabled={false}
      form={form}
      {...extra}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  ) : (
    <span>Unregistered</span>
  );
}

export function setup(
  def: FieldDef,
  extra: Partial<FieldProps> = {},
): RenderResult & { onChange: Mock; onBlur: Mock } {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  const result = renderWithBrume(
    <Harness def={def} extra={extra} onChange={onChange} onBlur={onBlur} />,
  );
  return { ...result, onChange, onBlur };
}
