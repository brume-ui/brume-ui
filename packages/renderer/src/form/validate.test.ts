import type { ClientRule, FieldDef, FormNode } from '@brume-ui/brume-schema';
import { expect, it } from 'vitest';
import { collectFields, validateValue } from './validate';

const field = (rules: ClientRule[]): FieldDef => ({
  type: 'text',
  name: 'name',
  label: 'Name',
  rules,
});
const cases: Array<[ClientRule, unknown, unknown]> = [
  [{ rule: 'required', message: 'required' }, 'yes', ''],
  [{ rule: 'minLength', value: 2, message: 'short' }, '😀😀', '😀'],
  [{ rule: 'maxLength', value: 2, message: 'long' }, '😀😀', '😀😀😀'],
  [{ rule: 'min', value: 2, message: 'small' }, '2.00', 1],
  [{ rule: 'max', value: 2, message: 'big' }, 2, '2.01'],
  [{ rule: 'email', message: 'email' }, 'a@example.com', 'invalid'],
  [{ rule: 'url', message: 'url' }, 'https://example.com/a', '/relative'],
  [{ rule: 'integer', message: 'integer' }, '-2', 2.1],
  [{ rule: 'numeric', message: 'numeric' }, '2.50', '2foo'],
  [{ rule: 'pattern', pattern: '^\\p{L}+$', message: 'pattern' }, '中文', 'a2'],
  [{ rule: 'maxFiles', value: 1, message: 'files' }, [{}], [{}, {}]],
];
it.each(cases)('checks %j pass and fail', (rule, pass, fail) => {
  expect(validateValue(field([rule]), pass)).toBeNull();
  expect(validateValue(field([rule]), fail)).toBe(rule.message);
});
it.each([null, undefined, '', [], '   '])('only required rejects empty %j', (value) => {
  expect(
    validateValue(
      field(cases.map(([rule]) => rule).filter((rule) => rule.rule !== 'required')),
      value,
    ),
  ).toBeNull();
  expect(validateValue(field([{ rule: 'required', message: 'required' }]), value)).toBe('required');
});
it('preserves rule order and accepts zero and false as present', () => {
  expect(
    validateValue(
      field([
        { rule: 'maxLength', value: 1, message: 'first' },
        { rule: 'email', message: 'second' },
      ]),
      'bad',
    ),
  ).toBe('first');
  expect(validateValue(field([{ rule: 'required', message: 'required' }]), false)).toBeNull();
  expect(validateValue(field([{ rule: 'required', message: 'required' }]), 0)).toBeNull();
});
it.each([false, true, {}, Infinity, NaN, 'Infinity', '0x10'])(
  'rejects non decimal numeric values %j',
  (value) => {
    expect(validateValue(field([{ rule: 'numeric', message: 'numeric' }]), value)).toBe('numeric');
  },
);
it('fails invalid patterns without throwing and skips non editable fields', () => {
  expect(validateValue(field([{ rule: 'pattern', pattern: '[', message: 'pattern' }]), 'a')).toBe(
    'pattern',
  );
  for (const def of [
    { ...field([{ rule: 'required', message: 'required' }]), readOnly: true },
    { ...field([{ rule: 'required', message: 'required' }]), type: 'hidden' as const },
    { ...field([{ rule: 'required', message: 'required' }]), type: 'display' as const },
  ])
    expect(validateValue(def, '')).toBeNull();
});
it('collects all layout branches in order, including inactive sections and nested embeds', () => {
  const f: FormNode = { type: 'field', field: field([]) };
  const nodes: FormNode[] = [
    { type: 'section', key: 'one', title: 'One', children: [f] },
    {
      type: 'columns',
      columns: [
        {
          width: 6,
          children: [
            {
              type: 'embeds',
              name: 'meta',
              label: 'Meta',
              children: [{ type: 'block', children: [{ type: 'row', children: [f] }] }],
            },
          ],
        },
      ],
    },
    { type: 'divider' },
    { type: 'section', key: 'two', title: 'Two', children: [f] },
  ];
  expect(collectFields(nodes, 'base').map(({ path }) => path)).toEqual([
    'base.name',
    'base.meta.name',
    'base.name',
  ]);
});
