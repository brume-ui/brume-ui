import type { FormDef, FormPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { FormView, type FormViewHandle } from '../form-view';
import { Nodes } from '../layout/nodes';
import { type FormApi, useFormState } from '../use-form-state';
import { useFormSubmit } from '../use-form-submit';
import { collectFields } from '../validate';

function NodesHarness({ form }: { form: FormDef }) {
  const api = useFormState(form, {});
  return <Nodes nodes={form.nodes} api={api} idPrefix="t" layout="stacked" />;
}

function ViewHarness({ form }: { form: FormDef }) {
  const api = useFormState(form, {});
  return <FormView form={form} api={api} />;
}

const captchaForm: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'text', name: 'name', label: 'Name' } },
    {
      type: 'field',
      field: { type: 'captcha', name: 'code', label: '驗證碼', src: '/captcha/default' },
    },
  ],
};

function SubmitHarness({
  page,
  onState,
}: {
  page: FormPage;
  onState(api: FormApi, submit: ReturnType<typeof useFormSubmit>['submit']): void;
}) {
  const api = useFormState(page.form, page.values);
  const ref = useRef<FormViewHandle>(null);
  const { submit } = useFormSubmit(page, api, ref);
  onState(api, submit);
  return <FormView ref={ref} form={page.form} api={api} />;
}

function submitHarness(
  respond: NonNullable<Parameters<typeof renderWithBrume>[1]>['respond'],
  form: FormDef = captchaForm,
  values: Record<string, unknown> = { name: 'a' },
) {
  const page = {
    type: 'form',
    title: 'T',
    name: 'T',
    formId: 'f',
    mode: 'create',
    form,
    values,
    submit: { method: 'post', url: '/save', label: 'Save' },
    after: { options: ['edit'], default: 'edit' },
    presentation: 'modal',
    size: 'md',
  } as FormPage;
  let api!: FormApi;
  let submit!: ReturnType<typeof useFormSubmit>['submit'];
  const rendered = renderWithBrume(
    <SubmitHarness
      page={page}
      onState={(nextApi, nextSubmit) => {
        api = nextApi;
        submit = nextSubmit;
      }}
    />,
    { respond },
  );
  return { ...rendered, api: () => api, submit: () => submit('edit') };
}

const src = () => (screen.getByRole('img') as HTMLImageElement).getAttribute('src');

describe('captcha field', () => {
  it('shows the image, takes the answer and keeps it out of read-only views', () => {
    const { api } = submitHarness(() => ({ status: 200, data: {} }));
    expect(src()).toBe('/captcha/default?r=0');
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'ab12' },
    });
    expect(api().values.code).toBe('ab12');
  });
  it('is not part of dirty tracking', () => {
    const { api } = submitHarness(() => ({ status: 200, data: {} }));
    expect(api().dirty).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'ab12' },
    });
    expect(api().dirty).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'b' } });
    expect(api().dirty).toBe(true);
  });
  it('is skipped when the field is read only', () => {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: { type: 'captcha', name: 'code', label: '驗證碼', src: '/c', readOnly: true },
        },
      ],
    };
    renderWithBrume(<NodesHarness form={form} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('a failed submit clears the answer and reloads the image, keeping its error', async () => {
    const h = submitHarness(() => ({
      status: 422,
      data: { message: 'bad', errors: { code: ['驗證碼錯誤'] } },
    }));
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'zzzz' },
    });
    await act(async () => {
      await h.submit();
    });
    expect((screen.getByRole('textbox', { name: '驗證碼' }) as HTMLInputElement).value).toBe('');
    expect(src()).toBe('/captcha/default?r=1');
    expect(screen.getAllByText('驗證碼錯誤').length).toBeGreaterThan(0);
    expect(h.api().values.name).toBe('a');
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'next' },
    });
    await act(async () => {
      await h.submit();
    });
    expect(src()).toBe('/captcha/default?r=2');
  });
  it('reloads even when the errors are about another field', async () => {
    const h = submitHarness(() => ({
      status: 422,
      data: { message: 'bad', errors: { name: ['重複'] } },
    }));
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'zzzz' },
    });
    await act(async () => {
      await h.submit();
    });
    expect(src()).toBe('/captcha/default?r=1');
    expect((screen.getByRole('textbox', { name: '驗證碼' }) as HTMLInputElement).value).toBe('');
  });
  it('a successful submit does not reload the image', async () => {
    const h = submitHarness(() => ({ status: 200, data: { feedback: {} } }));
    fireEvent.change(screen.getByRole('textbox', { name: '驗證碼' }), {
      target: { value: 'ok12' },
    });
    await act(async () => {
      await h.submit();
    });
    expect(src()).toBe('/captcha/default?r=0');
  });
});

const buttonForm: FormDef = {
  layout: 'stacked',
  sections: 'tabs',
  nodes: [
    { type: 'button', label: '說明文件', href: '/help', variant: 'secondary' },
    {
      type: 'section',
      key: 'a',
      title: 'A',
      children: [
        { type: 'button', label: '外部', href: 'https://example.com/x', newTab: true },
        {
          type: 'block',
          title: 'B',
          children: [{ type: 'field', field: { type: 'text', name: 'name', label: 'Name' } }],
        },
        {
          type: 'embeds',
          name: 'meta',
          label: 'Meta',
          children: [
            { type: 'button', label: '內嵌', href: '/embed' },
            { type: 'field', field: { type: 'text', name: 'tag', label: 'Tag' } },
          ],
        },
      ],
    },
    { type: 'button', label: '壞連結', href: 'javascript:alert(1)' },
  ],
};

describe('button node', () => {
  it('renders a link with the button look, in blocks, sections and embeds', () => {
    renderWithBrume(<NodesHarness form={buttonForm} />);
    const help = screen.getByRole('link', { name: '說明文件' });
    expect(help.getAttribute('href')).toBe('/help');
    expect(help.getAttribute('target')).toBeNull();
    expect(screen.getByRole('link', { name: '內嵌' }).getAttribute('href')).toBe('/embed');
  });
  it('newTab opens a new tab safely', () => {
    renderWithBrume(<NodesHarness form={buttonForm} />);
    const link = screen.getByRole('link', { name: /外部/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('an unsafe href renders nothing', () => {
    renderWithBrume(<NodesHarness form={buttonForm} />);
    expect(screen.queryByText('壞連結')).toBeNull();
  });
  it('a plain click visits through the adapter', () => {
    const { adapter } = renderWithBrume(<NodesHarness form={buttonForm} />);
    fireEvent.click(screen.getByRole('link', { name: '說明文件' }));
    expect(adapter.calls).toContainEqual({ fn: 'visit', args: ['/help'] });
  });
  it('takes no part in validation, tabs or value collection', () => {
    expect(collectFields(buttonForm.nodes).map((f) => f.path)).toEqual(['name', 'meta.tag']);
    renderWithBrume(<ViewHarness form={buttonForm} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});
