import type { FormDef } from '@brume-ui/brume-schema';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import type { FieldProps } from '../contract';
import { Nodes } from '../layout/nodes';
import { registerBuiltInField } from '../registry';
import { type FormApi, useFormState } from '../use-form-state';
import { TextField } from './text';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'text', name: 'root', label: 'Root' } },
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
          {
            type: 'field',
            field: {
              type: 'text',
              name: 'note',
              label: 'Note',
              showWhen: { field: { scope: 'row', path: 'quantity' }, op: 'eq', value: '9' },
            },
          },
        ],
      },
    },
  ],
};
it('renders real draft Nodes with relative errors and conditions without touching parent values before commit', async () => {
  let api!: FormApi;
  // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
  function Harness() {
    api = useFormState(form, { root: 'live', products: [{ id: 'a', quantity: '2' }] });
    return <Nodes nodes={form.nodes} api={api} idPrefix="test" layout="stacked" />;
  }
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: () => ({
      status: 200,
      data: {
        data: [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ],
        pagination: { page: 1, perPage: 20, hasMore: false },
      },
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  await screen.findByRole('checkbox', { name: 'Select Banana' });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '9' } });
  expect(screen.getByLabelText('Note')).toBeTruthy();
  expect(api.getValue('products.0.quantity')).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.dirty).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  expect(screen.getByLabelText('Quantity')).toHaveProperty('value', '2');
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(api.getValue('products')).toEqual([{ id: 'a', quantity: '5' }]));
  expect(document.querySelectorAll('form')).toHaveLength(0);
});

import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import { act } from '@testing-library/react';
import { StrictMode } from 'react';

it('keeps flattened server errors and touch ownership local until cancel', () => {
  let api!: FormApi;
  // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
  function Harness() {
    api = useFormState(form, { products: [{ id: 'a', quantity: '2' }] });
    return <Nodes nodes={form.nodes} api={api} idPrefix="errors" layout="stacked" />;
  }
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: () => ({
      status: 200,
      data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
    }),
  });
  act(() => api.setServerErrors({ 'products.0.quantity': ['Bad quantity'] }));
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  expect(screen.getByText('Bad quantity')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '9' } });
  expect(screen.queryByText('Bad quantity')).toBeNull();
  expect(api.errors['products.0.quantity']).toEqual(['Bad quantity']);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  expect(screen.getByText('Bad quantity')).toBeTruthy();
});

it.each([false, true])(
  'owns pending uploads and aborts cancelled draft completion (StrictMode=%s)',
  async (strict) => {
    let api!: FormApi;
    let complete!: (response: HttpResponse) => void;
    let upload!: HttpRequest;
    const uploadForm: FormDef = {
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
              {
                type: 'field',
                field: {
                  type: 'upload',
                  name: 'file',
                  label: 'File',
                  kind: 'file',
                  multiple: false,
                  accept: [],
                  maxSize: 1000,
                },
              },
            ],
          },
        },
      ],
    };
    // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
    function Harness() {
      api = useFormState(uploadForm, { products: [{ id: 'a' }] });
      return (
        <Nodes
          nodes={uploadForm.nodes}
          api={api}
          idPrefix="uploads"
          layout="stacked"
          uploadUrl="/upload"
        />
      );
    }
    const { container } = renderWithBrume(
      strict ? (
        <StrictMode>
          <Harness />
        </StrictMode>
      ) : (
        <Harness />
      ),
      {
        locale: 'en',
        respond: (request) => {
          if (request.url === '/upload') {
            upload = request;
            return new Promise((resolve) => {
              complete = resolve;
            });
          }
          return {
            status: 200,
            data: {
              data: [{ value: 'a', label: 'Apple' }],
              pagination: { page: 1, perPage: 20, hasMore: false },
            },
          };
        },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'draft.txt')] },
    });
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
    expect(api.pendingUploads).toBe(0);
    expect(api.getValue('products')).toEqual([{ id: 'a' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(upload.signal?.aborted).toBe(true);
    await act(async () =>
      complete({
        status: 200,
        data: {
          token: 'late',
          name: 'draft.txt',
          size: 1,
          mime: 'text/plain',
          expiresAt: 'tomorrow',
        },
      }),
    );
    expect(api.getValue('products')).toEqual([{ id: 'a' }]);
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false);
    expect(screen.queryByText('draft.txt')).toBeNull();
  },
);

it('closes a draft on source dependency reset and rejects late old search without losing committed extras', async () => {
  let api!: FormApi;
  let finish!: (response: HttpResponse) => void;
  const remoteForm: FormDef = {
    ...form,
    nodes: form.nodes.map((node) =>
      node.type === 'field' && node.field.type === 'relation'
        ? {
            ...node,
            field: {
              ...node.field,
              remote: { url: '/products', dependsOn: { root: { scope: 'root', path: 'root' } } },
            },
          }
        : node,
    ),
  };
  // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
  function Harness() {
    api = useFormState(remoteForm, { root: 'A', products: [{ id: 'a', quantity: '2' }] });
    return <Nodes nodes={remoteForm.nodes} api={api} idPrefix="source" layout="stacked" />;
  }
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: (request) =>
      request.query?.q !== undefined && request.query?.depends === '{"root":"A"}'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { status: 200, data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } } },
  });
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '9' } });
  act(() => api.setValue('root', 'B'));
  expect(screen.queryByRole('textbox', { name: 'Search' })).toBeNull();
  await act(async () =>
    finish({
      status: 200,
      data: {
        data: [{ value: 'old', label: 'Stale old' }],
        pagination: { page: 1, perPage: 20, hasMore: false },
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  expect(screen.getByLabelText('Quantity')).toHaveProperty('value', '2');
  expect(screen.queryByText('Stale old')).toBeNull();
});

it('composes two selection edits synchronously and exposes sibling changes before React commits', () => {
  const owners = new Map<string, FormApi>();
  // biome-ignore lint/correctness/noComponentHookFactories: stable observer delegates to the real text control for this test.
  function ObservedText(props: FieldProps) {
    if (props.path.startsWith('products.')) owners.set(props.path, props.form);
    return <TextField {...props} />;
  }
  registerBuiltInField('text', ObservedText);
  let api!: FormApi;
  // biome-ignore lint/correctness/noComponentHookFactories: one stable test harness.
  function Harness() {
    api = useFormState(form, {
      products: [
        { id: 'a', quantity: '2' },
        { id: 'b', quantity: '3' },
      ],
    });
    return <Nodes nodes={form.nodes} api={api} idPrefix="siblings" layout="stacked" />;
  }
  try {
    renderWithBrume(<Harness />, {
      locale: 'en',
      respond: () => ({
        status: 200,
        data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    act(() => {
      owners.get('products.0.quantity')?.setValue('products.0.quantity', '9');
      expect(owners.get('products.1.quantity')?.getValue('products.0.quantity')).toBe('9');
      owners.get('products.1.quantity')?.setValue('products.1.quantity', '8');
      expect(owners.get('products.0.quantity')?.getValue('products.1.quantity')).toBe('8');
    });
    expect(owners.get('products.0.quantity')?.dirty).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(api.getValue('products')).toEqual([
      { id: 'a', quantity: '9' },
      { id: 'b', quantity: '8' },
    ]);
  } finally {
    registerBuiltInField('text', TextField);
  }
});

it('rejects a noncooperative dependent extra response after a sibling edit and same-event remove/reselect', async () => {
  const owners = new Map<string, FormApi>();
  // biome-ignore lint/correctness/noComponentHookFactories: stable observer delegates to the real text control for this test.
  function ObservedText(props: FieldProps) {
    if (props.path.startsWith('products.')) owners.set(props.path, props.form);
    return <TextField {...props} />;
  }
  registerBuiltInField('text', ObservedText);
  const nestedForm: FormDef = {
    ...form,
    nodes: form.nodes.map((node) =>
      node.type === 'field' && node.field.type === 'relation'
        ? {
            ...node,
            field: {
              ...node.field,
              fields: [
                ...(node.field.fields ?? []),
                {
                  type: 'field',
                  field: {
                    type: 'select',
                    name: 'child',
                    label: 'Child',
                    remote: {
                      url: '/children',
                      dependsOn: { quantity: { scope: 'root', path: 'products.0.quantity' } },
                    },
                  },
                },
              ],
            },
          }
        : node,
    ),
  };
  const delayed: { request: HttpRequest; finish(response: HttpResponse): void }[] = [];
  // biome-ignore lint/correctness/noComponentHookFactories: one stable test harness.
  function Harness() {
    const api = useFormState(nestedForm, {
      products: [
        { id: 'a', quantity: '2', child: 'x' },
        { id: 'b', quantity: '3', child: 'x' },
      ],
    });
    return <Nodes nodes={nestedForm.nodes} api={api} idPrefix="remote-extra" layout="stacked" />;
  }
  try {
    renderWithBrume(<Harness />, {
      locale: 'en',
      respond: (request) => {
        if (request.url === '/children' && request.query?.depends === '{"quantity":"2"}')
          return new Promise((finish) => delayed.push({ request, finish }));
        return {
          status: 200,
          data: {
            data:
              request.url === '/children'
                ? [{ value: 'x', label: 'Fresh child' }]
                : [
                    { value: 'a', label: 'Apple' },
                    { value: 'b', label: 'Banana' },
                  ],
            pagination: { page: 1, perPage: 20, hasMore: false },
          },
        };
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    await screen.findByRole('checkbox', { name: 'Select Apple' });
    await waitFor(() => expect(delayed.length).toBe(2));
    const oldA = owners.get('products.0.quantity');
    const oldState = oldA?.stateId;
    await act(async () => {
      owners.get('products.0.quantity')?.setValue('products.0.quantity', '9');
      expect(owners.get('products.1.quantity')?.getValue('products.0.quantity')).toBe('9');
      for (const entry of delayed)
        entry.finish({
          status: 200,
          data: {
            data: [{ value: 'x', label: 'Stale child' }],
            pagination: { page: 1, perPage: 20, hasMore: false },
          },
        });
    });
    expect(screen.queryByDisplayValue('Stale child')).toBeNull();
    await waitFor(() => expect(screen.getAllByDisplayValue('Fresh child')).toHaveLength(2));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
      expect(oldA?.getField('products.0.child')).toBeUndefined();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Apple' }));
      expect(oldA?.getField('products.0.child')).toBeUndefined();
      oldA?.setValue('products.0.quantity', 'stale write');
    });
    expect(owners.get('products.1.quantity')?.stateId).not.toBe(oldState);
    expect(screen.queryByDisplayValue('stale write')).toBeNull();
    expect(
      screen.getAllByLabelText('Quantity').map((input) => (input as HTMLInputElement).value),
    ).toEqual(['3', '']);
  } finally {
    registerBuiltInField('text', TextField);
  }
});

it.each(['earlier', 'owner', 'reselect'] as const)(
  'keeps upload ownership when removing the %s selection',
  async (removed) => {
    let api!: FormApi;
    let complete!: (response: HttpResponse) => void;
    let upload!: HttpRequest;
    const uploadForm: FormDef = {
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
              {
                type: 'field',
                field: {
                  type: 'upload',
                  name: 'file',
                  label: 'File',
                  kind: 'file',
                  multiple: false,
                  accept: [],
                  maxSize: 1000,
                },
              },
            ],
          },
        },
      ],
    };
    // biome-ignore lint/correctness/noComponentHookFactories: one stable test harness.
    function Harness() {
      api = useFormState(uploadForm, { products: [{ id: 'a' }, { id: 'b' }] });
      return (
        <Nodes
          nodes={uploadForm.nodes}
          api={api}
          idPrefix="moving-uploads"
          layout="stacked"
          uploadUrl="/upload"
        />
      );
    }
    const { container } = renderWithBrume(<Harness />, {
      locale: 'en',
      respond: (request) => {
        if (request.url === '/upload') {
          upload = request;
          return new Promise((resolve) => {
            complete = resolve;
          });
        }
        return {
          status: 200,
          data: {
            data: [
              { value: 'a', label: 'Apple' },
              { value: 'b', label: 'Banana' },
            ],
            pagination: { page: 1, perPage: 20, hasMore: false },
          },
        };
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Products/ }));
    await screen.findByRole('button', { name: 'Remove “Banana”' });
    const originalB = container.querySelectorAll<HTMLInputElement>('input[type=file]')[1];
    if (!originalB) throw new Error('B upload input missing');
    fireEvent.change(originalB, { target: { files: [new File(['x'], 'b.txt')] } });
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
    act(() => {
      fireEvent.click(
        screen.getByRole('button', {
          name: removed === 'earlier' ? 'Remove “Apple”' : 'Remove “Banana”',
        }),
      );
      if (removed === 'reselect')
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banana' }));
    });
    expect(upload.signal?.aborted).toBe(removed !== 'earlier');
    if (removed === 'earlier') {
      expect(container.querySelector('input[type=file]')).toBe(originalB);
      expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
    }
    await act(async () =>
      complete({
        status: 200,
        data: {
          token: 'b-upload',
          name: 'b.txt',
          size: 1,
          mime: 'text/plain',
          expiresAt: 'tomorrow',
        },
      }),
    );
    expect(api.getValue('products')).toEqual([{ id: 'a' }, { id: 'b' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(api.getValue('products')).toEqual(
      removed === 'earlier'
        ? [{ id: 'b', file: { token: 'b-upload' } }]
        : removed === 'reselect'
          ? [{ id: 'a' }, { id: 'b' }]
          : [{ id: 'a' }],
    );
  },
);
