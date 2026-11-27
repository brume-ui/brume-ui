import { Alert, Field, HideFieldLabels, Repeater } from '@brume-ui/brume-react';
import { useContext } from 'react';
import type { FieldProps } from '../contract';
import { FieldIdPrefixContext } from '../field-navigation';
import { Nodes } from '../layout/nodes';
import { rowDefaults } from '../row-defaults';
import { repeaterIdentities } from '../row-identity';

export function RepeaterField(props: FieldProps) {
  const namespace = useContext(FieldIdPrefixContext);
  if (props.def.type !== 'repeater') return null;
  const { def, form, path } = props;
  const identities = repeaterIdentities(props.value, def.mode);
  if (!identities) return <Alert tone="danger">Invalid row identity: {path}</Alert>;
  const disabled = props.disabled || props.readOnly;
  const change = () => props.onBlur();
  const shared = {
    label: def.label,
    rows: identities,
    min: def.min,
    max: def.max,
    disabled,
    sortable: def.sortable === true,
    onAdd: () => {
      const rows = form.getValue(path);
      if (disabled || (Array.isArray(rows) && def.max !== undefined && rows.length >= def.max))
        return;
      props.onChange([
        ...(Array.isArray(rows) ? rows : []),
        { ...rowDefaults(def.nodes), _brume: { key: crypto.randomUUID() } },
      ]);
      change();
    },
    onRemove: (index: number) => {
      if (!disabled && identities.length > (def.min ?? 0)) {
        form.removeRow(path, index);
        change();
      }
    },
    onMove: (from: number, to: number) => {
      if (!disabled && def.sortable) form.moveRow(path, from, to);
    },
  };
  // Table layout: one column per direct field (the declaration check guarantees nothing else is
  // there). Each cell is the ordinary field pipeline for that single node, so conditions, errors,
  // ownership and focus navigation behave as in a stacked row; a hidden cell stays an empty cell.
  const columns = def.nodes.flatMap((node) =>
    node.type === 'field'
      ? [{ key: node.field.name, label: node.field.label, required: node.field.required }]
      : [],
  );
  if (def.layout === 'table')
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
            {...shared}
            layout="table"
            columns={columns}
            renderCell={(_row, index, key) => {
              const node = def.nodes.find((n) => n.type === 'field' && n.field.name === key);
              return node ? (
                <HideFieldLabels>
                  <Nodes
                    nodes={[node]}
                    api={form}
                    idPrefix={namespace ?? props.id}
                    layout="stacked"
                    prefix={`${path}.${index}`}
                    rowPath={`${path}.${index}`}
                    uploadUrl={props.uploadUrl}
                    rowContext={props.rowContext}
                    row
                    cell
                  />
                </HideFieldLabels>
              ) : null;
            }}
          />
        </Field>
      </fieldset>
    );
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
          {...shared}
          renderRow={(_row, index) => (
            <Nodes
              nodes={def.nodes}
              api={form}
              idPrefix={namespace ?? props.id}
              layout="stacked"
              prefix={`${path}.${index}`}
              rowPath={`${path}.${index}`}
              uploadUrl={props.uploadUrl}
              rowContext={props.rowContext}
            />
          )}
        />
      </Field>
    </fieldset>
  );
}
