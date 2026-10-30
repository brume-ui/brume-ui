import type { FieldDef, FormDef } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import axe from 'axe-core';
import { createRef, type Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../schema/fixtures/valid/form-full.json';
import { renderWithBrume } from '../test-utils';
import { FormView, type FormViewHandle, sectionErrorKeys } from './form-view';
import { type FormApi, useFormState } from './use-form-state';

const field = (name: string, type: 'text' | 'textarea' = 'text') => ({
  type: 'field' as const,
  field: { name, label: name, type },
});
function Harness({
  form,
  initial,
  formRef,
  onApi,
}: {
  form: FormDef;
  initial: Record<string, unknown>;
  formRef: Ref<FormViewHandle>;
  onApi(api: FormApi): void;
}) {
  const api = useFormState(form, initial);
  onApi(api);
  return <FormView ref={formRef} form={form} api={api} uploadUrl="/upload" />;
}
function setup(form: FormDef, initial = {}, options: Parameters<typeof renderWithBrume>[1] = {}) {
  let api: FormApi;
  const ref = createRef<FormViewHandle>();
  const result = renderWithBrume(
    <Harness
      form={form}
      initial={initial}
      formRef={ref}
      onApi={(next) => {
        api = next;
      }}
    />,
    options,
  );
  return { ...result, ref, api: () => api };
}
describe('FormView', () => {
  it('spans long fields, hides hidden fields without a slot, and allocates row widths', () => {
    const { container } = setup({
      layout: 'stacked',
      nodes: [
        field('short'),
        field('long', 'textarea'),
        { type: 'field', field: { type: 'hidden', name: 'secret', label: 'Secret' } },
        {
          type: 'row',
          children: [
            { type: 'field', field: { type: 'text', name: 'wide', label: 'wide', width: 8 } },
          ],
        },
      ],
    });
    expect(screen.getByLabelText('long').closest('[data-field-path]')?.className).toContain(
      'col-span-full',
    );
    expect(screen.getByLabelText('short').closest('[data-field-path]')?.className).not.toContain(
      'col-span-full',
    );
    expect(container.querySelector('[data-field-path="secret"]')).toBeNull();
    expect(
      screen.getByLabelText('wide').closest('[data-field-path]')?.getAttribute('style'),
    ).toContain('span 8');
  });
  it('sets horizontal Field layout and writes embeds to nested values', () => {
    const result = setup({
      layout: 'horizontal',
      nodes: [{ type: 'embeds', name: 'meta', label: 'Metadata', children: [field('color')] }],
    });
    const input = screen.getByLabelText('color');
    expect(input.closest('[data-field-layout]')?.getAttribute('data-field-layout')).toBe(
      'horizontal',
    );
    fireEvent.change(input, { target: { value: 'red' } });
    expect(result.api().values).toEqual({ meta: { color: 'red' } });
  });
  it('switches tabs before focusing errors, and summary links focus the field', () => {
    const form: FormDef = {
      layout: 'stacked',
      sections: 'tabs',
      nodes: [
        { type: 'section', key: 'one', title: 'One', children: [field('first')] },
        { type: 'section', key: 'two', title: 'Two', children: [field('second')] },
      ],
    };
    const result = setup(form);
    act(() => result.api().setServerErrors({ second: ['Wrong'] }));
    expect(sectionErrorKeys(form, result.api().errors)).toEqual(new Set(['two']));
    expect(screen.getByRole('tab', { name: 'Two（有錯誤）' })).toBeTruthy();
    act(() => {
      expect(result.ref.current?.focusFirstError()).toBe(true);
    });
    expect(document.activeElement).toBe(screen.getByLabelText('second'));
    fireEvent.click(screen.getByRole('tab', { name: 'One' }));
    fireEvent.click(screen.getByRole('link', { name: /Wrong/ }));
    expect(document.activeElement).toBe(screen.getByLabelText('second'));
  });
  it('unclaimed server errors show in the summary and take focus', () => {
    const result = setup({ layout: 'stacked', nodes: [field('name')] });
    act(() => result.api().setServerErrors({ total: ['Server failure'] }));
    expect(screen.getByRole('alert').textContent).toContain('Server failure');
    act(() => {
      expect(result.ref.current?.focusFirstError()).toBe(true);
    });
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
  it('focuses range bounds and keeps IDs stable and distinct across instances', () => {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [{ type: 'field', field: { type: 'dateRange', name: 'period', label: 'Period' } }],
    };
    const result = setup(form);
    const id = screen.getByLabelText('Period（迄）').id;
    act(() => result.api().setServerErrors({ 'period.end': ['Invalid end'] }));
    act(() => result.ref.current?.focusFirstError());
    expect(document.activeElement?.id).toBe(id);
    expect(screen.getByRole('link').getAttribute('href')).toBe(`#${id}`);
    setup(form);
    expect(new Set(screen.getAllByLabelText('Period（迄）').map((el) => el.id)).size).toBe(2);
  });
  it('renders an unknown field diagnostic', () => {
    setup({
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: { name: 'future', label: 'Future', type: 'future' } as unknown as FieldDef,
        },
      ],
    });
    expect(screen.getByText(/future/)).toBeTruthy();
  });
  it('validates upload extras on blur and submit and focuses the exact extra control', () => {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'upload',
            name: 'images',
            label: 'Images',
            kind: 'file',
            multiple: true,
            accept: [],
            maxSize: 100,
            extra: [
              {
                type: 'text',
                name: 'link',
                label: 'Link',
                rules: [{ rule: 'required', message: 'Link required' }],
              },
            ],
          },
        },
      ],
    };
    const result = setup(form, { images: [{ path: 'a.pdf', url: '/a.pdf', extra: {} }] });
    const extra = screen.getByLabelText('Link');
    fireEvent.blur(extra);
    expect(result.api().errors['images.0.extra.link']).toEqual(['Link required']);
    act(() => result.ref.current?.focusFirstError());
    expect(document.activeElement).toBe(extra);
    expect(screen.getByRole('link', { name: /Link required/ }).getAttribute('href')).toBe(
      `#${extra.id}`,
    );
    act(() => result.api().reset({ images: [] }));
    act(() => {
      result.api().setValue('images', [{ path: 'b.pdf', url: '/b.pdf', extra: {} }]);
      expect(result.api().validateAll()).toBe(false);
    });
    expect(result.api().errors['images.0.extra.link']).toEqual(['Link required']);
  });
  it('has no axe violations for the complete form-full fixture', async () => {
    const { container } = setup(
      { ...fixture.page.form, sections: 'stack' } as FormDef,
      fixture.page.values,
    );
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('renders section, block, columns and labeled divider structure', () => {
    const { container } = setup({
      layout: 'stacked',
      nodes: [
        {
          type: 'section',
          key: 'a',
          title: 'Section',
          description: 'Description',
          children: [
            {
              type: 'block',
              title: 'Block',
              children: [
                {
                  type: 'columns',
                  columns: [
                    { width: 4, children: [field('left')] },
                    { width: 8, children: [field('right')] },
                  ],
                },
              ],
            },
            { type: 'divider', label: 'Next' },
          ],
        },
      ],
    });
    expect(screen.getByRole('region', { name: 'Section' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Block' })).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(container.querySelector('[style*="--br-form-column-span: span 4"]')).toBeTruthy();
    expect(container.querySelector('[style*="--br-form-column-span: span 8"]')).toBeTruthy();
  });
  it('validates single upload extra paths while skipping read-only upload extras', () => {
    const upload: FieldDef = {
      type: 'upload',
      name: 'cover',
      label: 'Cover',
      kind: 'file',
      multiple: false,
      accept: [],
      maxSize: 100,
      extra: [
        {
          type: 'text',
          name: 'link',
          label: 'Link',
          rules: [{ rule: 'required', message: 'Required' }],
        },
      ],
    };
    const result = setup(
      {
        layout: 'stacked',
        nodes: [
          { type: 'field', field: upload },
          { type: 'field', field: { ...upload, name: 'locked', readOnly: true } },
        ],
      },
      { cover: { path: 'x', url: '/x', extra: {} }, locked: { path: 'y', url: '/y', extra: {} } },
    );
    act(() => {
      expect(result.api().validateAll()).toBe(false);
    });
    expect(result.api().errors).toEqual({ 'cover.extra.link': ['Required'] });
    act(() => result.ref.current?.focusFirstError());
    expect(document.activeElement).toBe(screen.getByLabelText('Link'));
  });

  it('focuses the first erroneous field in form order regardless of server key order', () => {
    const result = setup({ layout: 'stacked', nodes: [field('first'), field('second')] });
    act(() => result.api().setServerErrors({ second: ['Second'], first: ['First'] }));
    act(() => result.ref.current?.focusFirstError());
    expect(document.activeElement).toBe(screen.getByLabelText('first'));
  });
  it('keeps trailing non-section nodes after the tabs', () => {
    setup({
      layout: 'stacked',
      sections: 'tabs',
      nodes: [
        { type: 'section', key: 'a', title: 'A', children: [field('inside')] },
        field('after'),
      ],
    });
    expect(
      screen.getByRole('tablist').compareDocumentPosition(screen.getByLabelText('after')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

it('reveals the focused field together with its help and error, not just the control', () => {
  const result = setup({
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: { type: 'text', name: 'color', label: 'Color', help: 'Choose an available color' },
      },
    ],
  });
  act(() => result.api().setServerErrors({ color: ['Unavailable color'] }));
  const requested: Element[] = [];
  const reveal = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
    this: Element,
  ) {
    requested.push(this);
  });
  try {
    act(() => result.ref.current?.focusFirstError());
    expect(document.activeElement).toBe(screen.getByLabelText('Color'));
    expect(
      requested.some(
        (region) =>
          region.contains(screen.getByLabelText('Color')) &&
          region.contains(screen.getByText('Choose an available color')) &&
          region.contains(screen.getAllByText('Unavailable color').at(-1) ?? null),
      ),
    ).toBe(true);
  } finally {
    reveal.mockRestore();
  }
});

it('omits conditional wrappers, retains disabled drafts and keeps literal hidden inputs', () => {
  const condition = {
    op: 'eq' as const,
    field: { scope: 'root' as const, path: 'on' },
    value: true,
  };
  const result = setup(
    {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'switch', name: 'on', label: 'On' } },
        {
          type: 'field',
          field: { type: 'text', name: 'note', label: 'Note', showWhen: condition },
        },
        {
          type: 'field',
          field: { type: 'text', name: 'draft', label: 'Draft', enableWhen: condition },
        },
        { type: 'field', field: { type: 'hidden', name: 'secret', label: 'Secret' } },
      ],
    },
    { on: false, note: 'kept', draft: 'draft', secret: 'wire' },
  );
  expect(screen.queryByLabelText('Note')).toBeNull();
  expect(result.container.querySelector('[data-field-path="note"]')).toBeNull();
  expect((screen.getByLabelText('Draft') as HTMLInputElement).disabled).toBe(true);
  expect(result.api().getValue('secret')).toBe('wire');
  expect(result.api().getField('secret')?.active).toBe(true);
  act(() => result.api().setValue('on', true));
  expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('kept');
  expect((screen.getByLabelText('Draft') as HTMLInputElement).disabled).toBe(false);
});

it('applies shared activity to upload extras and retains unrelated extra errors on edits', () => {
  const result = setup(
    {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'switch', name: 'on', label: 'On' } },
        {
          type: 'field',
          field: {
            type: 'upload',
            name: 'files',
            label: 'Files',
            kind: 'file',
            multiple: true,
            accept: [],
            maxSize: 100,
            extra: [
              {
                type: 'text',
                name: 'note',
                label: 'Note',
                showWhen: { op: 'eq', field: { scope: 'root', path: 'on' }, value: true },
                rules: [{ rule: 'required', message: 'Required' }],
              },
              { type: 'text', name: 'caption', label: 'Caption' },
            ],
          },
        },
      ],
    },
    { on: false, files: [{ path: 'a', url: '/a', extra: { note: 'kept', caption: 'before' } }] },
  );
  act(() => result.api().setServerErrors({ 'files.0.extra.note': ['Retained'] }));
  expect(screen.queryByLabelText('Note')).toBeNull();
  expect(result.api().errors).toEqual({});
  fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'after' } });
  act(() => result.api().setValue('on', true));
  expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('kept');
  expect(result.api().errors).toEqual({ 'files.0.extra.note': ['Retained'] });
});

it('shows unknown inactive-container errors as unclaimed summary entries', () => {
  const result = setup(
    {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'switch', name: 'on', label: 'On' } },
        {
          type: 'field',
          field: {
            type: 'repeater',
            name: 'rows',
            label: 'Rows',
            mode: 'json',
            showWhen: { op: 'eq', field: { scope: 'root', path: 'on' }, value: true },
            nodes: [field('name')],
          },
        },
      ],
    },
    { on: false, rows: [{ _brume: { key: 'a' }, name: 'A' }] },
  );
  act(() =>
    result
      .api()
      .setServerErrors({ 'rows.0.name': ['Known inactive'], 'rows.99.name': ['Unknown row'] }),
  );
  expect(screen.getByRole('alert').textContent).toContain('Unknown row');
  expect(screen.queryByRole('link', { name: /Unknown row/ })).toBeNull();
  act(() => expect(result.ref.current?.focusFirstError()).toBe(true));
  expect(document.activeElement).toBe(screen.getByRole('alert'));
});

it.each(['summary', 'imperative'] as const)(
  'focuses relation errors and reveals closed selected extras through %s navigation',
  (navigation) => {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'relation',
            name: 'products',
            label: 'Products',
            multiple: true,
            remote: { url: '/products' },
            fields: [
              { type: 'field', field: { type: 'text', name: 'quantity', label: 'Quantity' } },
            ],
          },
        },
      ],
    };
    const result = setup(
      form,
      { products: [{ id: 'a', quantity: '2' }] },
      {
        respond: () => ({
          status: 200,
          data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
        }),
      },
    );
    act(() => result.api().setServerErrors({ products: ['Choose products'] }));
    const relationLink = screen.getByRole('link', { name: 'Products: Choose products' });
    const trigger = screen.getByRole('button', { name: /Products/ });
    if (navigation === 'summary') fireEvent.click(relationLink);
    else
      act(() => {
        expect(result.ref.current?.focusFirstError()).toBe(true);
      });
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => result.api().setServerErrors({ 'products.0.quantity': ['Bad quantity'] }));
    const extraLink = screen.getByRole('link', { name: 'Quantity: Bad quantity' });
    expect(screen.queryByLabelText('Quantity')).toBeNull();
    if (navigation === 'summary') fireEvent.click(extraLink);
    else
      act(() => {
        expect(result.ref.current?.focusFirstError()).toBe(true);
      });
    const quantity = screen.getByLabelText('Quantity');
    expect(document.activeElement).toBe(quantity);
    expect(extraLink.getAttribute('href')).toBe(`#${quantity.id}`);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.focus();
    fireEvent.click(extraLink);
    expect(document.activeElement).toBe(quantity);
  },
);
