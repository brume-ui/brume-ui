import { Button } from '@brume-ui/brume-react';
import { FormView, useFormState } from '@brume-ui/brume-renderer';
import type { FormDef } from '@brume-ui/brume-schema';
import { Page, Panel } from './page';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'repeater',
        name: 'groups',
        label: 'Groups',
        mode: 'json',
        sortable: true,
        max: 4,
        nodes: [
          { type: 'field', field: { type: 'text', name: 'name', label: 'Group name' } },
          {
            type: 'field',
            field: {
              type: 'repeater',
              name: 'thresholds',
              label: 'Thresholds',
              mode: 'relation',
              sortable: true,
              min: 1,
              distinct: ['amount'],
              nodes: [
                {
                  type: 'field',
                  field: {
                    type: 'currency',
                    name: 'amount',
                    label: 'Threshold amount',
                    decimals: 2,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
};
const values = {
  groups: [
    {
      _brume: { key: 'a' },
      name: 'First',
      thresholds: [
        { _brume: { key: 'aa', id: '1' }, amount: '100.00' },
        { _brume: { key: 'ab', id: '2' }, amount: '200.00' },
      ],
    },
    {
      _brume: { key: 'b' },
      name: 'Second',
      thresholds: [{ _brume: { key: 'ba', id: '3' }, amount: '300.00' }],
    },
  ],
};
export function FormRepeatersPage() {
  const api = useFormState(form, values);
  return (
    <Page name="form-repeaters" title="Nested repeaters">
      <Panel>
        <FormView form={form} api={api} />
        <Button onClick={() => api.validateAll()}>Validate rows</Button>
        <output data-testid="repeater-values">{JSON.stringify(api.values)}</output>
      </Panel>
    </Page>
  );
}
