import type { HttpResponse } from '@brume-ui/brume-react';
import type { CustomFieldDef, ListPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FieldProps } from '../../form/contract';
import { createRegistry } from '../../registry';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';

function NameField({
  value,
  onChange,
  disabled,
  def,
  id,
  errors,
}: FieldProps<string, CustomFieldDef>) {
  return (
    <>
      <input
        id={id}
        aria-label={def.label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {errors['']?.map((message) => (
        <span key={message}>{message}</span>
      ))}
    </>
  );
}
const page: ListPage = {
  type: 'list',
  title: 'Names',
  gridId: 'names',
  columns: [
    {
      key: 'name',
      label: 'Name',
      editor: { type: 'custom', component: { type: 'component', name: 'NameField' } },
    },
  ],
  rows: [{ id: 1, name: 'Original' }],
  pagination: { page: 1, perPage: 20, total: 1, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  endpoints: { cell: '/cells/{id}' },
};

// Closing while a PATCH is pending must neither lose the keyboard position nor reopen a draft.
describe('pending custom editor cancellation', () => {
  it.each([
    { close: 'Cancel', status: 200 },
    { close: 'Escape', status: 200 },
    { close: 'Cancel', status: 422 },
    { close: 'Escape', status: 422 },
  ] as const)(
    'keeps immediate and settled focus after $close, with PATCH status $status',
    async ({ close, status }) => {
      const user = userEvent.setup();
      let finish!: (response: HttpResponse) => void;
      const { adapter } = renderWithBrume(<GridView page={page} />, {
        locale: 'en',
        registry: createRegistry({
          mode: 'vite',
          fields: { NameField: { component: NameField, inlineEditable: true } },
        }),
        respond: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      });
      await user.click(screen.getByRole('button', { name: 'Edit Name: Original' }));
      await user.clear(screen.getByRole('textbox', { name: 'Name' }));
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Saved');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      screen.getByRole('button', { name: 'Cancel' }).focus();
      if (close === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');

      const trigger = screen.getByRole('button', { name: 'Edit Name: Saved' });
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute('aria-disabled')).toBe('true');
      expect(trigger.getAttribute('aria-busy')).toBe('true');
      expect(screen.queryByRole('textbox')).toBeNull();
      // aria-disabled is focusable: pointer and keyboard activation need the explicit pending guard.
      fireEvent.click(trigger);
      await user.keyboard('{Enter} ');
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(1);
      expect(adapter.calls.find((call) => call.fn === 'request')?.args[0]).toMatchObject({
        method: 'patch',
        url: '/cells/1',
        body: { column: 'name', value: 'Saved' },
      });

      await act(async () =>
        finish(
          status === 200
            ? { status: 200, data: { row: { id: 1, name: 'Saved' } } }
            : { status: 422, data: { errors: { name: ['Name rejected'] } } },
        ),
      );
      const settled = screen.getByRole('button', {
        name: status === 200 ? 'Edit Name: Saved' : 'Edit Name: Original',
      });
      expect(document.activeElement).toBe(settled);
      expect(settled.hasAttribute('aria-disabled')).toBe(false);
      expect(settled.hasAttribute('aria-busy')).toBe(false);
      expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(1);
      if (status === 422) expect(screen.getByRole('alert').textContent).toBe('Name rejected');
      await user.click(settled);
      expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('value')).toBe(
        status === 200 ? 'Saved' : 'Original',
      );
    },
  );
});

it('enforces serialized custom editor root rules before sending the cell PATCH', async () => {
  const user = userEvent.setup();
  const { adapter } = renderWithBrume(
    <GridView
      page={{
        ...page,
        columns: [
          {
            key: 'name',
            label: 'Name',
            editor: {
              type: 'custom',
              component: { type: 'component', name: 'NameField' },
              rules: [
                { rule: 'required', message: 'Contact is required.' },
                { rule: 'email', message: 'Contact must be an email.' },
                { rule: 'maxLength', value: 8, message: 'Contact is too long.' },
              ],
            },
          },
        ],
      }}
    />,
    {
      locale: 'en',
      registry: createRegistry({
        mode: 'vite',
        fields: { NameField: { component: NameField, inlineEditable: true } },
      }),
      respond: () => ({ status: 200, data: { row: { id: 1, name: 'a@b.co' } } }),
    },
  );
  await user.click(screen.getByRole('button', { name: 'Edit Name: Original' }));
  const input = screen.getByRole('textbox', { name: 'Name' });
  for (const [value, message] of [
    ['', 'Contact is required.'],
    ['bad', 'Contact must be an email.'],
    ['long@example.com', 'Contact is too long.'],
  ] as const) {
    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(0);
  }
  await user.clear(input);
  await user.type(input, 'a@b.co');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(adapter.calls.find((call) => call.fn === 'request')?.args[0]).toMatchObject({
    method: 'patch',
    body: { column: 'name', value: 'a@b.co' },
  });
});
