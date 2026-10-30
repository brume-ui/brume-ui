import { Button } from '@brume-ui/brume-react';
import { FormView, GridView, RegistryProvider, useFormState } from '@brume-ui/brume-renderer';
import type { FormDef, ListPage } from '@brume-ui/brume-schema';
import { addressRegistry } from './custom-address';
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
              type: 'custom',
              name: 'address',
              label: 'Delivery address',
              span: 'full',
              component: { type: 'component', name: 'Address', props: { country: 'TW' } },
            },
          },
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
      address: { country: 'TW', city: 'Taipei', postalCode: '100', street: '1 Example Road' },
      thresholds: [
        { _brume: { key: 'aa', id: '1' }, amount: '100.00' },
        { _brume: { key: 'ab', id: '2' }, amount: '200.00' },
      ],
    },
    {
      _brume: { key: 'b' },
      name: 'Second',
      address: { country: 'TW', city: 'Tainan', postalCode: '700', street: '2 Example Road' },
      thresholds: [{ _brume: { key: 'ba', id: '3' }, amount: '300.00' }],
    },
  ],
};
export function FormRepeatersPage() {
  const api = useFormState(form, values);
  const groups = api.values.groups as typeof values.groups;
  return (
    <RegistryProvider registry={addressRegistry}>
      <Page name="form-repeaters" title="Nested repeaters">
        <Panel>
          <FormView form={form} api={api} />
          <Button onClick={() => api.validateAll()}>Validate rows</Button>
          <Button
            onClick={() =>
              api.setServerErrors({ 'groups.0.address.city': ['Check the delivery city.'] })
            }
          >
            Show address error
          </Button>
          <output data-testid="repeater-values">{JSON.stringify(api.values)}</output>
        </Panel>
        <Panel>
          <GridView
            page={
              {
                type: 'list',
                title: 'Delivery addresses',
                gridId: 'address-preview',
                columns: [
                  {
                    key: 'address',
                    label: 'Address',
                    display: { type: 'component', name: 'Address' },
                  },
                ],
                rows: groups.map((group) => ({
                  id: group._brume.key,
                  address: group.address,
                })),
                pagination: { page: 1, perPage: 20, total: groups.length, lastPage: 1 },
                query: { perPage: 20, filters: {} },
                perPageOptions: [20],
                appliedFilters: [],
                actions: { row: [], batch: [], tools: [] },
              } satisfies ListPage
            }
          />
        </Panel>
      </Page>
    </RegistryProvider>
  );
}
