import type { FieldDef, FormDef, FormNode, FormPage } from '@brume-ui/brume-schema';
import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { FormView, type FormViewHandle } from './form-view';
import { type FormApi, useFormState } from './use-form-state';
import { useFormSubmit } from './use-form-submit';

const field = (type: string, name: string, extra: Record<string, unknown> = {}): FormNode => ({
  type: 'field',
  field: { type, name, label: name.toUpperCase(), ...extra } as unknown as FieldDef,
});
const def = (...nodes: FormNode[]): FormDef => ({ layout: 'stacked', nodes });
const required = { rules: [{ rule: 'required', message: '必填' }] };

function Harness({
  form,
  values,
  onApi,
}: {
  form: FormDef;
  values: Record<string, unknown>;
  onApi?(api: FormApi, view: { current: FormViewHandle | null }): void;
}) {
  const api = useFormState(form, values);
  const view = useRef<FormViewHandle>(null);
  onApi?.(api, view);
  return <FormView ref={view} form={form} api={api} />;
}
function setup(form: FormDef, values: Record<string, unknown> = {}) {
  let api!: FormApi;
  let view: { current: FormViewHandle | null } = { current: null };
  const rendered = renderWithBrume(
    <Harness
      form={form}
      values={values}
      onApi={(next, handle) => {
        api = next;
        view = handle;
      }}
    />,
  );
  return { ...rendered, api: () => api, view: () => view.current };
}
const validate = (api: FormApi) =>
  act(() => {
    api.validateAll();
  });

function SubmitHarness({
  page,
  values,
  onState,
}: {
  page: FormPage;
  values: Record<string, unknown>;
  onState(api: FormApi, submit: ReturnType<typeof useFormSubmit>['submit']): void;
}) {
  const api = useFormState(page.form, values);
  const ref = useRef<FormViewHandle>(null);
  onState(api, useFormSubmit(page, api, ref).submit);
  return <FormView ref={ref} form={page.form} api={api} />;
}

describe('keyValue', () => {
  const form = def(field('keyValue', 'headers'));
  it('shows a duplicate key on the second row and a blank trailing row does not block', () => {
    const s = setup(form, {
      headers: [
        { key: 'a', value: '1' },
        { key: ' a ', value: '2' },
        { key: '', value: '' },
      ],
    });
    validate(s.api());
    expect(s.api().errors).toEqual({ 'headers.1.key': ['鍵不可重複'] });
    const keys = screen.getAllByLabelText(/^鍵/);
    expect(keys[1]?.getAttribute('aria-invalid')).toBe('true');
    expect(keys[0]?.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('鍵不可重複')).toBeTruthy();
    act(() =>
      s.api().setValue('headers', [
        { key: 'a', value: '1' },
        { key: '', value: '' },
      ]),
    );
    validate(s.api());
    expect(s.api().errors).toEqual({});
  });
  it('maps a post-drop error index onto the visible row (a blank row sits above it)', () => {
    const s = setup(form, {
      headers: [
        { key: '', value: '' },
        { key: 'a', value: '1' },
        { key: '', value: 'orphan' },
      ],
    });
    validate(s.api());
    // post-drop index 1 is the third visible row
    expect(s.api().errors).toEqual({ 'headers.1.key': ['請輸入鍵'] });
    const keys = screen.getAllByLabelText(/^鍵/);
    expect(keys[2]?.getAttribute('aria-invalid')).toBe('true');
    expect(keys[0]?.getAttribute('aria-invalid')).toBeNull();
  });
  it('required means at least one pair', () => {
    const s = setup(def(field('keyValue', 'headers', required)), {
      headers: [{ key: '', value: '' }],
    });
    validate(s.api());
    expect(s.api().errors).toEqual({ headers: ['必填'] });
  });
  it('typing in the control writes pairs', () => {
    const s = setup(form, { headers: [] });
    fireEvent.click(screen.getByRole('button', { name: /新增/ }));
    expect(s.api().getValue('headers')).toEqual([{ key: '', value: '' }]);
  });
});

describe('list', () => {
  it('puts a per-item error on the right visible row when blanks were dropped above it', () => {
    const s = setup(def(field('list', 'items', { maxLength: 3 })), {
      items: ['', 'ok', '  ', 'toolong'],
    });
    validate(s.api());
    // submitted list is ['ok', 'toolong']: the error is at index 1, visible row 3
    expect(s.api().errors).toEqual({ 'items.1': ['每項不可超過 3 個字'] });
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.map((i) => i.getAttribute('aria-invalid'))).toEqual([null, null, null, 'true']);
    expect(screen.getByText('每項不可超過 3 個字')).toBeTruthy();
  });
  it('shows a field-level count error at the field', () => {
    const s = setup(def(field('list', 'items', { min: 2 })), { items: ['a', ' '] });
    validate(s.api());
    expect(s.api().errors).toEqual({ items: ['至少需要 2 項'] });
    expect(screen.getByText('至少需要 2 項')).toBeTruthy();
  });
});

describe('tree', () => {
  const options = [
    { value: 'p', label: 'P', depth: 0 },
    { value: 'a', label: 'A', depth: 1 },
    { value: 'b', label: 'B', depth: 1 },
  ];
  const form = def(field('tree', 'perms', { mode: 'leaves', options, ...required }));
  it('canonicalises a legacy value on load without making the form dirty', () => {
    const { result } = renderHook(() => useFormState(form, { perms: ['p', 'gone'] }));
    expect(result.current.values.perms).toEqual(['a', 'b']);
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue('perms', ['a']));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
  });
  it('seeds trees inside repeater rows too', () => {
    const rows = def(
      field('repeater', 'rows', {
        mode: 'json',
        nodes: [field('tree', 'perms', { mode: 'leaves', options })],
      }),
    );
    const { result } = renderHook(() =>
      useFormState(rows, { rows: [{ _brume: { key: 'k' }, perms: ['p'] }] }),
    );
    expect(result.current.getValue('rows.0.perms')).toEqual(['a', 'b']);
    expect(result.current.dirty).toBe(false);
  });
  it('required fails when only unknown ids remain', () => {
    const { result } = renderHook(() => useFormState(form, { perms: ['gone'] }));
    expect(result.current.validateAll()).toBe(false);
  });
  it('renders a tree control', () => {
    setup(form, { perms: ['a'] });
    expect(screen.getByRole('tree')).toBeTruthy();
  });
});

describe('autocomplete', () => {
  it('behaves as text: free text is kept, blank is null, minLength rule applies', () => {
    const s = setup(
      def(
        field('autocomplete', 'city', {
          options: ['台北', '高雄'],
          rules: [{ rule: 'minLength', value: 2, message: '太短' }],
        }),
      ),
      { city: null },
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '花蓮縣' } });
    expect(s.api().getValue('city')).toBe('花蓮縣');
    fireEvent.change(input, { target: { value: '' } });
    expect(s.api().getValue('city')).toBeNull();
    fireEvent.change(input, { target: { value: 'x' } });
    validate(s.api());
    expect(s.api().errors).toEqual({ city: ['太短'] });
  });
});

describe('listbox', () => {
  it('multipleSelect with appearance listbox renders the dual listbox', () => {
    const s = setup(
      def(
        field('multipleSelect', 'pick', {
          appearance: 'listbox',
          options: [
            { value: 'a', label: 'AA' },
            { value: 'b', label: 'BB' },
          ],
        }),
      ),
      { pick: ['a'] },
    );
    expect(screen.getAllByRole('listbox')).toHaveLength(2);
    expect(s.api().getValue('pick')).toEqual(['a']);
  });
});

describe('repeater table layout', () => {
  const table = def(
    field('repeater', 'rows', {
      mode: 'json',
      layout: 'table',
      nodes: [
        field('text', 'name'),
        field('text', 'note', {
          showWhen: { op: 'eq', field: { scope: 'row', path: 'name' }, value: 'show' },
        }),
        field('select', 'kind', { options: [{ value: 'x', label: 'X' }], ...required }),
      ],
    }),
  );
  const rows = [
    { _brume: { key: 'r1' }, name: 'show', note: '', kind: null },
    { _brume: { key: 'r2' }, name: '', note: 'hidden', kind: null },
  ];
  it('renders a table with one column per field and names every input', () => {
    setup(table, { rows });
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByLabelText('NAME')).toHaveLength(2);
  });
  it('keeps a hidden cell as an empty cell so columns stay aligned', () => {
    setup(table, { rows });
    const tbody = document.querySelector('tbody') as HTMLElement;
    const second = within(tbody).getAllByRole('row')[1] as HTMLElement;
    const cells = second.querySelectorAll('td');
    // name, note, kind, actions
    expect(cells).toHaveLength(4);
    expect(cells[1]?.querySelector('input')).toBeNull();
    expect(screen.getAllByLabelText('NOTE')).toHaveLength(1);
  });
  it('shows errors inline in the cell', () => {
    const s = setup(table, { rows });
    validate(s.api());
    expect(s.api().errors).toEqual({ 'rows.0.kind': ['必填'], 'rows.1.kind': ['必填'] });
    const cell = screen.getAllByText('必填')[0]?.closest('td') as HTMLElement;
    expect(
      cell.querySelector('button[aria-invalid="true"],input[aria-invalid="true"]'),
    ).not.toBeNull();
  });
});

describe('fieldset', () => {
  const form = def(field('text', 'before', {}), {
    type: 'fieldset',
    key: 'adv',
    title: '進階',
    collapsed: true,
    children: [field('text', 'deep', required)],
  });
  const toggle = () => screen.getByRole('button', { name: '進階' });
  it('starts collapsed, keeps its field mounted, and reopens on every failed submit', () => {
    const s = setup(form, { before: '', deep: '' });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('input[type="text"][id*="deep"]')).not.toBeNull();
    validate(s.api());
    act(() => {
      s.view()?.focusFirstError();
    });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('DEEP'));
    // collapse again: values and validation are untouched, the next failed submit reopens it
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(s.api().validateAll()).toBe(false);
    act(() => {
      s.view()?.focusFirstError();
    });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
  it('reopens when the error summary jumps to a field inside', () => {
    const s = setup(form, { before: '', deep: '' });
    validate(s.api());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('link', { name: /DEEP/ }));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('link', { name: /DEEP/ }));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('DEEP'));
  });
  it('does not reopen for an error elsewhere', () => {
    const other = def(field('text', 'before', required), {
      type: 'fieldset',
      key: 'adv',
      title: '進階',
      collapsed: true,
      children: [field('text', 'deep')],
    });
    const s = setup(other, { before: '', deep: '' });
    validate(s.api());
    act(() => {
      s.view()?.focusFirstError();
    });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('group', () => {
  const when = { op: 'eq', field: { scope: 'root', path: 'kind' }, value: 'on' } as const;
  const form = def(field('text', 'kind'), {
    type: 'group',
    showWhen: when,
    children: [
      { type: 'html', html: '<p>說明文字</p>' },
      field('text', 'inner', { showWhen: when, ...required }),
    ],
  });
  it('renders children only while its showWhen is true and keeps the draft', () => {
    const s = setup(form, { kind: 'on', inner: 'draft' });
    expect(screen.getByText('說明文字')).toBeTruthy();
    expect(screen.getByLabelText('INNER')).toBeTruthy();
    act(() => s.api().setValue('kind', 'off'));
    expect(screen.queryByText('說明文字')).toBeNull();
    expect(screen.queryByLabelText('INNER')).toBeNull();
    expect(s.api().getValue('inner')).toBe('draft');
    // the hidden required field does not block saving
    expect(s.api().validateAll()).toBe(true);
    act(() => s.api().setValue('kind', 'on'));
    expect((screen.getByLabelText('INNER') as HTMLInputElement).value).toBe('draft');
  });
  it('evaluates row-scoped paths against its own repeater row', () => {
    const rowWhen = { op: 'eq', field: { scope: 'row', path: 'kind' }, value: 'on' } as const;
    const rows = def(
      field('repeater', 'rows', {
        mode: 'json',
        nodes: [
          field('text', 'kind'),
          {
            type: 'group',
            showWhen: rowWhen,
            children: [
              { type: 'html', html: '<p>只在開啟的列</p>' },
              field('text', 'inner', { showWhen: rowWhen }),
            ],
          },
        ],
      }),
    );
    setup(rows, {
      rows: [
        { _brume: { key: 'a' }, kind: 'on' },
        { _brume: { key: 'b' }, kind: 'off' },
      ],
    });
    expect(screen.getAllByText('只在開啟的列')).toHaveLength(1);
    expect(screen.getAllByLabelText('INNER')).toHaveLength(1);
  });
  it('rejects a group condition on an unknown path at declaration time', () => {
    const bad = def({
      type: 'group',
      showWhen: { op: 'eq', field: { scope: 'root', path: 'missing' }, value: 1 },
      children: [],
    });
    expect(() => renderHook(() => useFormState(bad, {}))).toThrow(/Unknown declaration path/);
  });
});

describe('submit', () => {
  it('sends keyValue, list and tree as validated and resets the baseline to what was sent', async () => {
    const options = [
      { value: 'p', label: 'P', depth: 0 },
      { value: 'a', label: 'A', depth: 1 },
    ];
    const form = def(
      field('keyValue', 'h'),
      field('text', 'gate'),
      field('list', 'l'),
      field('tree', 't', { mode: 'leaves', options }),
      field('list', 'hiddenList', {
        showWhen: { op: 'eq', field: { scope: 'root', path: 'gate' }, value: 1 },
      }),
    );
    const page = {
      type: 'form',
      title: 'T',
      name: 'N',
      formId: 'f',
      mode: 'edit',
      form,
      values: {},
      submit: { method: 'put', url: '/x', label: 'S' },
      after: { options: ['edit'], default: 'edit' },
      presentation: 'page',
      size: 'md',
    } as unknown as FormPage;
    let api!: FormApi;
    let submit!: ReturnType<typeof useFormSubmit>['submit'];
    const sent: unknown[] = [];
    renderWithBrume(
      <SubmitHarness
        page={page}
        values={{
          h: [
            { key: ' k ', value: 'v' },
            { key: '', value: '' },
          ],
          l: ['', ' x ', '  '],
          t: ['p'],
          hiddenList: ['', 'draft'],
        }}
        onState={(next, send) => {
          api = next;
          submit = send;
        }}
      />,
      {
        respond: (req) => {
          sent.push(req.body);
          return { status: 200, data: { record: { id: 1 } } } as never;
        },
      },
    );
    await act(async () => {
      await submit('edit');
    });
    expect(sent[0]).toEqual({
      values: {
        h: [{ key: 'k', value: 'v' }],
        l: [' x '],
        t: ['a'],
        // hidden: left exactly as drafted
        hiddenList: ['', 'draft'],
      },
      after: 'edit',
    });
    expect(api.values.l).toEqual([' x ']);
    expect(api.dirty).toBe(false);
  });
});
