import { Alert, Field, Repeater } from '@brume-ui/brume-react';
import { useContext } from 'react';
import type { FieldProps } from '../contract';
import { FieldIdPrefixContext } from '../field-navigation';
import { Nodes } from '../layout/nodes';
import { repeaterIdentities } from '../row-identity';

export function RepeaterField(props: FieldProps) {
  const namespace = useContext(FieldIdPrefixContext);
  if (props.def.type !== 'repeater') return null;
  const { def, form, path } = props;
  const identities = repeaterIdentities(props.value, def.mode);
  if (!identities) return <Alert tone="danger">Invalid row identity: {path}</Alert>;
  const disabled = props.disabled || props.readOnly;
  const change = () => props.onBlur();
  return (
    <fieldset id={props.id} className="br:min-w-0">
      <Field
        label={def.label}
        description={def.help}
        error={props.errors['']?.[0]}
        required={def.required}
        group
      >
        <Repeater
          label={def.label}
          rows={identities}
          min={def.min}
          max={def.max}
          disabled={disabled}
          sortable={def.sortable === true}
          onAdd={() => {
            const rows = form.getValue(path);
            if (
              disabled ||
              (Array.isArray(rows) && def.max !== undefined && rows.length >= def.max)
            )
              return;
            props.onChange([
              ...(Array.isArray(rows) ? rows : []),
              { _brume: { key: crypto.randomUUID() } },
            ]);
            change();
          }}
          onRemove={(index) => {
            if (!disabled && identities.length > (def.min ?? 0)) {
              form.removeRow(path, index);
              change();
            }
          }}
          onMove={(from, to) => {
            if (!disabled && def.sortable) form.moveRow(path, from, to);
          }}
          renderRow={(_row, index) => (
            <Nodes
              nodes={def.nodes}
              api={form}
              idPrefix={namespace ?? props.id}
              layout="stacked"
              prefix={`${path}.${index}`}
              uploadUrl={props.uploadUrl}
              rowContext={props.rowContext}
            />
          )}
        />
      </Field>
    </fieldset>
  );
}
