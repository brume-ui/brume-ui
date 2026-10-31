import { createTranslator } from '@brume-ui/brume-react';
import type { FieldDef, FormDef, FormNode } from '@brume-ui/brume-schema';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFieldConditions } from './use-field-conditions';
import { useFormState } from './use-form-state';
import { collectValueFields } from './validate';

const node = (field: FieldDef): FormNode => ({ type: 'field', field });
const required = [{ rule: 'required' as const, message: 'Required' }];
const rootOn = { op: 'eq' as const, field: { scope: 'root' as const, path: 'on' }, value: true };
const rowOn = { ...rootOn, field: { scope: 'row' as const, path: 'on' } };
const form: FormDef = {
  layout: 'stacked',
  nodes: [
    node({ type: 'switch', name: 'on', label: 'On' }),
    node({
      type: 'text',
      name: 'conditional',
      label: 'Conditional',
      showWhen: rootOn,
      rules: required,
    }),
    node({
      type: 'text',
      name: 'disabled',
      label: 'Disabled',
      enableWhen: rootOn,
      rules: required,
    }),
    node({
      type: 'repeater',
      name: 'rows',
      label: 'Rows',
      mode: 'json',
      nodes: [
        node({ type: 'switch', name: 'on', label: 'On' }),
        node({ type: 'text', name: 'name', label: 'Name', showWhen: rowOn, rules: required }),
      ],
    }),
  ],
};

it('retains inactive drafts and restores their server errors unless their value changed', () => {
  const { result } = renderHook(() =>
    useFormState(form, { on: false, conditional: 'draft', disabled: '', rows: [] }),
  );
  act(() =>
    result.current.setServerErrors({ conditional: ['Saved error'], disabled: ['Disabled error'] }),
  );
  expect(result.current.errors).toEqual({});
  act(() => expect(result.current.validateAll()).toBe(true));
  expect(result.current.getValue('conditional')).toBe('draft');
  act(() => result.current.setValue('on', true));
  expect(result.current.errors).toEqual({
    conditional: ['Saved error'],
    disabled: ['Disabled error'],
  });
  act(() => {
    result.current.setValue('on', false);
    result.current.setValue('conditional', 'changed');
    result.current.setValue('on', true);
  });
  expect(result.current.errors.conditional).toBeUndefined();
  act(() => {
    result.current.setValue('on', false);
    result.current.setServerErrors({ unknown: ['Blocks'] });
    expect(result.current.validateAll()).toBe(false);
  });
});

it('resolves conditions from each explicit row and selects the longest error owner', () => {
  const { result } = renderHook(() =>
    useFormState(form, {
      on: false,
      rows: [
        { _brume: { key: 'a' }, on: false, name: '' },
        { _brume: { key: 'b' }, on: true, name: '' },
      ],
    }),
  );
  act(() => {
    result.current.setServerErrors({
      'rows.0.name.detail': ['Inactive'],
      'rows.1.name.detail': ['Active'],
      unknown: ['Unknown'],
    });
    result.current.validateAll();
  });
  expect(result.current.errors).toEqual({
    'rows.1.name': ['Required'],
    'rows.1.name.detail': ['Active'],
    unknown: ['Unknown'],
  });
});

it('moves and removes row descendants without losing keys, touched state, sibling errors or form ownership', () => {
  const { result } = renderHook(() =>
    useFormState(form, {
      on: false,
      rows: [
        { _brume: { key: 'a', id: '10' }, on: true, name: '' },
        { _brume: { key: 'b' }, on: true, name: 'B' },
        { _brume: { key: 'c' }, on: false, name: '' },
      ],
    }),
  );
  const stateId = result.current.stateId;
  act(() => {
    result.current.touch('rows.0.name');
    result.current.setServerErrors({
      'rows.0.extra.deep.3.name': ['Deep'],
      'rows.2.name': ['Hidden'],
      unknown: ['Unknown'],
    });
  });
  expect(typeof result.current.moveRow).toBe('function');
  act(() => result.current.moveRow('rows', 0, 2));
  expect(result.current.getValue('rows.2._brume')).toEqual({ key: 'a', id: '10' });
  expect(result.current.errors).toEqual({
    'rows.2.name': ['Required'],
    'rows.2.extra.deep.3.name': ['Deep'],
    unknown: ['Unknown'],
  });
  act(() => result.current.removeRow('rows', 0));
  expect(result.current.errors).toEqual({
    'rows.1.name': ['Required'],
    'rows.1.extra.deep.3.name': ['Deep'],
    unknown: ['Unknown'],
  });
  act(() => result.current.setValue('rows.0.on', true));
  expect(result.current.errors['rows.0.name']).toEqual(['Hidden']);
  expect(result.current.stateId).toBe(stateId);
  expect(result.current.resetVersion).toBe(0);
  const before = result.current.values;
  for (const [path, from, to] of [
    ['rows', -1, 0],
    ['rows', 0, 9],
    ['rows.__proto__', 0, 0],
    ['rows..x', 0, 0],
  ] as const)
    expect(() => result.current.moveRow(path, from, to)).toThrow();
  expect(result.current.values).toBe(before);
});

it('keeps dependent required validation active when its controlling value is invalid', () => {
  const def: FormDef = {
    layout: 'stacked',
    nodes: [
      node({
        type: 'number',
        name: 'amount',
        label: 'Amount',
        rules: [{ rule: 'numeric', message: 'Number required' }],
      }),
      node({
        type: 'text',
        name: 'reason',
        label: 'Reason',
        rules: required,
        showWhen: { op: 'eq', field: { scope: 'root', path: 'amount' }, value: 1 },
      }),
    ],
  };
  const { result } = renderHook(() => useFormState(def, { amount: 'garbage', reason: '' }));
  act(() => result.current.validateAll());
  expect(result.current.errors).toEqual({ amount: ['Number required'], reason: ['Required'] });
  act(() => result.current.setValue('amount', '2'));
  expect(result.current.errors).toEqual({});
});

it('walks four levels, selected extras and uploads with explicit stable row metadata', () => {
  const leaf = node({ type: 'text', name: 'note', label: 'Note' });
  const repeat = (name: string, nodes: FormNode[]) =>
    node({ type: 'repeater', name, label: name, mode: 'json', nodes });
  const nodes = [
    repeat('one', [repeat('two', [repeat('three', [repeat('four', [leaf])])])]),
    node({
      type: 'relation',
      name: 'products',
      label: 'Products',
      multiple: true,
      remote: { url: '/options' },
      fields: [leaf],
    }),
  ];
  const values = {
    one: [
      {
        _brume: { key: 'a' },
        two: [
          {
            _brume: { key: 'b' },
            three: [{ _brume: { key: 'c' }, four: [{ _brume: { key: 'd' }, note: 'yes' }] }],
          },
        ],
      },
    ],
    products: [{ id: '007', note: 'extra' }],
  };
  const fields = collectValueFields(nodes, values);
  expect(fields.find((f) => f.path === 'one.0.two.0.three.0.four.0.note')).toMatchObject({
    templatePath: 'one.*.two.*.three.*.four.*.note',
    rowPath: 'one.0.two.0.three.0.four.0',
    rowContext: [
      { path: 'one', key: 'a' },
      { path: 'one.*.two', key: 'b' },
      { path: 'one.*.two.*.three', key: 'c' },
      { path: 'one.*.two.*.three.*.four', key: 'd' },
    ],
  });
  expect(fields.find((f) => f.path === 'products.0.note')).toMatchObject({
    rowPath: 'products.0',
    rowContext: [{ path: 'products', key: '007', id: '007' }],
  });
});

it('preserves unknown out-of-range errors during row movement and removal', () => {
  const { result } = renderHook(() =>
    useFormState(form, {
      on: false,
      rows: [
        { _brume: { key: 'a' }, on: true, name: 'A' },
        { _brume: { key: 'b' }, on: true, name: 'B' },
      ],
    }),
  );
  act(() => {
    result.current.setServerErrors({ 'rows.99.name': ['Unknown row'], unrelated: ['Unknown'] });
    result.current.moveRow('rows', 0, 1);
    result.current.removeRow('rows', 1);
  });
  expect(result.current.errors).toEqual({
    'rows.99.name': ['Unknown row'],
    unrelated: ['Unknown'],
  });
});

it.each([
  ['text', { type: 'text' }, { malformed: true }],
  ['selection', { type: 'select', options: [] }, 7],
  ['list', { type: 'multipleSelect', options: [] }, 'bad'],
  ['row array', { type: 'repeater', mode: 'json', nodes: [] }, {}],
  ['selected item', { type: 'relation', multiple: false, remote: { url: '/options' } }, { id: 7 }],
] as const)(
  'does not let a malformed %s controller hide required validation',
  (_name, props, value) => {
    const controller = { ...props, name: 'controller', label: 'Controller' } as FieldDef;
    const definition: FormDef = {
      layout: 'stacked',
      nodes: [
        node(controller),
        node({
          type: 'text',
          name: 'dependent',
          label: 'Dependent',
          rules: required,
          showWhen: { op: 'eq', field: { scope: 'root', path: 'controller' }, value: true },
        }),
      ],
    };
    const { result } = renderHook(() => useFormState(definition, { controller: value }));
    act(() => result.current.validateAll());
    expect(result.current.errors.controller?.length).toBe(1);
    expect(result.current.errors.dependent).toEqual(['Required']);
  },
);

it.each([
  ['en', 'Amount (has errors)'],
  ['zh-TW', 'Amount（有錯誤）'],
  ['zh-CN', 'Amount（有错误）'],
] as const)('uses existing %s vocabulary for intrinsic malformed values', (locale, expected) => {
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [node({ type: 'number', name: 'amount', label: 'Amount' })],
  };
  const { result } = renderHook(() =>
    useFormState(definition, { amount: 'bad' }, createTranslator(locale)),
  );
  act(() => result.current.validateAll());
  expect(result.current.errors).toEqual({ amount: [expected] });
});

it('exposes inherited activity through the public hook and the same field metadata', () => {
  const child: FieldDef = { type: 'text', name: 'note', label: 'Note' };
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [
      node({ type: 'switch', name: 'on', label: 'On' }),
      node({
        type: 'repeater',
        name: 'rows',
        label: 'Rows',
        mode: 'json',
        showWhen: rootOn,
        enableWhen: rootOn,
        nodes: [node(child)],
      }),
    ],
  };
  const { result } = renderHook(() => {
    const api = useFormState(definition, {
      on: false,
      rows: [{ _brume: { key: 'stable' }, note: 'kept' }],
    });
    return { api, conditions: useFieldConditions(child, api, 'rows.0') };
  });
  expect(result.current.conditions).toEqual({ visible: false, enabled: false });
  act(() => result.current.api.setValue('on', true));
  expect(result.current.conditions).toEqual({ visible: true, enabled: true });
  expect(result.current.api.getField('rows.0.note')).toMatchObject({
    rowPath: 'rows.0',
    templatePath: 'rows.*.note',
    rowContext: [{ path: 'rows', key: 'stable' }],
    active: true,
  });
});

it('moves a deep array without touching a sibling subtree and removes only the selected row errors', () => {
  const leaf = node({ type: 'text', name: 'note', label: 'Note', rules: required });
  const repeat = (name: string, nodes: FormNode[]) =>
    node({ type: 'repeater', name, label: name, mode: 'relation', nodes });
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [repeat('one', [repeat('two', [repeat('three', [repeat('four', [leaf])])])])],
  };
  const values = {
    one: [
      {
        _brume: { key: 'a' },
        two: [
          {
            _brume: { key: 'b' },
            three: [
              {
                _brume: { key: 'c' },
                four: [
                  { _brume: { key: 'd', id: '11' }, note: '' },
                  { _brume: { key: 'e', id: '12' }, note: 'E' },
                ],
              },
              { _brume: { key: 'sibling' }, four: [] },
            ],
          },
        ],
      },
    ],
  };
  const { result } = renderHook(() => useFormState(definition, values));
  act(() => {
    result.current.touch('one.0.two.0.three.0.four.0.note');
    result.current.setServerErrors({
      'one.0.two.0.three.0.four.1.note': ['Remove'],
      'one.0.two.0.three.1': ['Keep'],
    });
    result.current.moveRow('one.0.two.0.three.0.four', 1, 0);
  });
  expect(result.current.getValue('one.0.two.0.three.0.four.1._brume')).toEqual({
    key: 'd',
    id: '11',
  });
  expect(result.current.errors).toEqual({
    'one.0.two.0.three.0.four.1.note': ['Required'],
    'one.0.two.0.three.0.four.0.note': ['Remove'],
    'one.0.two.0.three.1': ['Keep'],
  });
  act(() => result.current.removeRow('one.0.two.0.three.0.four', 0));
  expect(result.current.errors).toEqual({
    'one.0.two.0.three.0.four.0.note': ['Required'],
    'one.0.two.0.three.1': ['Keep'],
  });
});

it('rejects a missing move destination without accidentally removing the row', () => {
  const initial = { on: false, rows: [{ _brume: { key: 'a' }, on: true, name: 'A' }] };
  const { result } = renderHook(() => useFormState(form, initial));
  expect(() => result.current.moveRow('rows', 0, undefined as unknown as number)).toThrow(/index/i);
  expect(result.current.values).toBe(initial);
  expect(result.current.dirty).toBe(false);
});

it('walks fields in row order so first-error focus follows the displayed field order', () => {
  const fields: FieldDef[] = [
    { type: 'text', name: 'first', label: 'First' },
    { type: 'text', name: 'second', label: 'Second' },
  ];
  const definition: FormNode[] = [
    node({ type: 'repeater', name: 'rows', label: 'Rows', mode: 'json', nodes: fields.map(node) }),
    node({
      type: 'upload',
      name: 'files',
      label: 'Files',
      multiple: true,
      kind: 'file',
      accept: [],
      maxSize: 10,
      extra: fields as Extract<FieldDef, { type: 'text' }>[],
    }),
  ];
  const paths = collectValueFields(definition, {
    rows: [{ _brume: { key: 'a' } }, { _brume: { key: 'b' } }],
    files: [{ path: 'a' }, { path: 'b' }],
  }).map((field) => field.path);
  expect(paths).toEqual([
    'rows',
    'rows.0.first',
    'rows.0.second',
    'rows.1.first',
    'rows.1.second',
    'files',
    'files.0.extra.first',
    'files.0.extra.second',
    'files.1.extra.first',
    'files.1.extra.second',
  ]);
});

it('rejects overprecision money before rounding can hide a dependent requirement', () => {
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [
      node({
        type: 'currency',
        name: 'amount',
        label: 'Amount',
        decimals: 2,
        rules: [{ rule: 'numeric', message: 'Not numeric' }],
      }),
      node({
        type: 'text',
        name: 'reason',
        label: 'Reason',
        rules: required,
        showWhen: { op: 'ne', field: { scope: 'root', path: 'amount' }, value: '500.00' },
      }),
    ],
  };
  const { result } = renderHook(() => useFormState(definition, { amount: '500.001', reason: '' }));
  act(() => result.current.validateAll());
  expect(result.current.errors).toEqual({ amount: ['Amount（有錯誤）'], reason: ['Required'] });
  expect(result.current.getValue('amount')).toBe('500.001');
  act(() => result.current.setValue('amount', '500.00'));
  expect(result.current.errors).toEqual({});
});

it.each([
  ['hidden', { showWhen: rootOn }],
  ['disabled', { disabled: true }],
  ['readonly', { readOnly: true }],
] as const)(
  'keeps unknown row errors blocking under a %s container while suppressing known inactive errors',
  (_state, flags) => {
    const definition: FormDef = {
      layout: 'stacked',
      nodes: [
        node({ type: 'switch', name: 'on', label: 'On' }),
        node({
          type: 'repeater',
          name: 'rows',
          label: 'Rows',
          mode: 'json',
          ...flags,
          nodes: [node({ type: 'text', name: 'name', label: 'Name' })],
        }),
      ],
    };
    const { result } = renderHook(() =>
      useFormState(definition, { on: false, rows: [{ _brume: { key: 'a' }, name: 'A' }] }),
    );
    act(() =>
      result.current.setServerErrors({
        rows: ['Known container'],
        'rows.0': ['Known row'],
        'rows.0.name': ['Known inactive'],
        'rows.0.unknown': ['Undeclared field'],
        'rows.99.name': ['Unknown row'],
      }),
    );
    expect(result.current.errors).toEqual({
      'rows.0.unknown': ['Undeclared field'],
      'rows.99.name': ['Unknown row'],
    });
    act(() => expect(result.current.validateAll()).toBe(false));
  },
);

it.each([
  [
    'relation',
    {
      type: 'relation',
      multiple: true,
      remote: { url: '/options' },
      fields: [node({ type: 'text', name: 'name', label: 'Name' })],
    },
    [{ id: '7', name: 'A' }],
    'name',
    'id',
  ],
  [
    'upload',
    {
      type: 'upload',
      multiple: true,
      kind: 'file',
      accept: [],
      maxSize: 10,
      extra: [{ type: 'text', name: 'name', label: 'Name' }],
    },
    [{ path: 'a', extra: { name: 'A' } }],
    'extra.name',
    'path',
  ],
] as const)(
  'does not claim absent %s item errors through a disabled parent',
  (_kind, props, value, known, metadata) => {
    const field = {
      ...props,
      name: 'items',
      label: 'Items',
      disabled: true,
    } as unknown as FieldDef;
    const { result } = renderHook(() =>
      useFormState({ layout: 'stacked', nodes: [node(field)] }, { items: value }),
    );
    act(() =>
      result.current.setServerErrors({
        [`items.0.${known}`]: ['Known inactive'],
        [`items.0.${metadata}`]: ['Known identity'],
        'items.0': ['Known item'],
        [`items.99.${known}`]: ['Absent item'],
        'items.0.unknown': ['Unknown field'],
      }),
    );
    expect(result.current.errors).toEqual({
      [`items.99.${known}`]: ['Absent item'],
      'items.0.unknown': ['Unknown field'],
    });
    act(() => expect(result.current.validateAll()).toBe(false));
  },
);

it('keeps custom composite relative errors owned by the custom field boundary', () => {
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [
      node({ type: 'switch', name: 'on', label: 'On' }),
      node({
        type: 'custom',
        name: 'calculator',
        label: 'Calculator',
        component: { type: 'component', name: 'Calculator' },
        showWhen: rootOn,
      }),
    ],
  };
  const { result } = renderHook(() => useFormState(definition, { on: false, calculator: {} }));
  act(() =>
    result.current.setServerErrors({ 'calculator.lines.99.amount': ['Custom relative error'] }),
  );
  expect(result.current.errors).toEqual({});
  act(() => result.current.setValue('on', true));
  expect(result.current.errors).toEqual({
    'calculator.lines.99.amount': ['Custom relative error'],
  });
  act(() => expect(result.current.validateAll()).toBe(false));
});

it('resolves row snapshots by stable identity across moves and preserves inherited locks', () => {
  const definition = {
    layout: 'stacked' as const,
    nodes: [
      node({
        type: 'repeater',
        mode: 'relation',
        name: 'rows',
        label: 'Rows',
        nodes: [
          node({ type: 'text', name: 'name', label: 'Name', readOnly: true, rules: required }),
        ],
      }),
    ],
    rowFields: [
      {
        row: [{ path: 'rows', key: 'a', id: '1' }],
        fields: { name: { readOnly: false, rules: [] } },
      },
      {
        row: [{ path: 'rows', key: 'b', id: '2' }],
        fields: { name: { readOnly: false, rules: required } },
      },
    ],
  };
  const { result } = renderHook(() =>
    useFormState(definition, {
      rows: [
        { _brume: { key: 'a', id: '1' }, name: '' },
        { _brume: { key: 'b', id: '2' }, name: '' },
        { _brume: { key: 'new' }, name: '' },
      ],
    }),
  );
  expect(result.current.getField('rows.0.name')?.active).toBe(true);
  expect(result.current.getField('rows.0.name')?.validationError).toBeNull();
  expect(result.current.getField('rows.1.name')?.validationError).toBe('Required');
  expect(result.current.getField('rows.2.name')?.readOnly).toBe(true);
  act(() => result.current.moveRow('rows', 0, 1));
  expect(result.current.getField('rows.0.name')?.validationError).toBe('Required');
  expect(result.current.getField('rows.1.name')?.validationError).toBeNull();
  const first = definition.nodes[0];
  if (first?.type !== 'field') throw new Error('Expected field');
  const locked = { ...definition, nodes: [node({ ...first.field, readOnly: true })] };
  const inherited = renderHook(() => useFormState(locked, result.current.values));
  expect(inherited.result.current.getField('rows.0.name')?.active).toBe(false);
});

it('rejects duplicate resolved contexts and unsafe relative override paths', () => {
  const row = [{ path: 'rows', key: 'a' }];
  expect(() =>
    collectValueFields([], {}, undefined, [
      { row, fields: {} },
      { row: [{ key: 'a', path: 'rows' }], fields: {} },
    ]),
  ).toThrow('Duplicate');
  expect(() =>
    collectValueFields([], {}, undefined, [
      { row, fields: { 'name.__proto__.x': { readOnly: true, rules: [] } } },
    ]),
  ).toThrow();
});
