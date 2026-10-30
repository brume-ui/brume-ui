/** Deterministic fake form endpoints. All demo transport goes through the memory adapter. */
import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import { type FormPage, type FormSubmitRequest, SCHEMA_VERSION } from '@brume-ui/brume-schema';
import fixture from '../../../../packages/schema/fixtures/valid/form-full.json';

export const FORM_UPLOAD_URL = '/admin/orders/upload';
export function buildFormPage(layout: 'stacked' | 'horizontal' = 'stacked', id = 42): FormPage {
  const page = structuredClone(fixture.page) as FormPage;
  const [basic, schedule, meta] = page.form.nodes;
  if (!basic || !schedule || meta?.type !== 'embeds') throw new Error('Invalid form fixture');
  const [color, ...uploads] = meta.children;
  if (basic.type === 'section')
    basic.children = basic.children.filter(
      (node) => node.type !== 'block' || node.children.length > 0,
    );
  page.form = {
    layout,
    sections: 'stack',
    nodes: [
      basic,
      schedule,
      {
        type: 'section',
        key: 'details',
        title: '附加資料',
        description: '顏色輸入 error 可示範伺服器驗證。',
        children: [{ ...meta, children: color ? [color] : [] }],
      },
      {
        type: 'section',
        key: 'files',
        title: '檔案附件',
        children: [{ ...meta, children: uploads }],
      },
    ],
  };
  page.record = { id, label: `#A${1000 + id}` };
  page.description = `訂單 #A${1000 + id}；所有變更僅保存在示範記憶體中。`;
  page.values = {
    ...page.values,
    quantity: 12,
    weight: '0.500',
    note: '請於平日配送',
    meta: {
      color: 'blue',
      images: [
        {
          path: 'sample-a.png',
          url: '/demo/order-package.svg',
          name: 'sample-a.png',
          extra: { link: '', visible: true },
        },
        {
          path: 'sample-b.png',
          url: '/demo/order-package.svg',
          name: 'sample-b.png',
          extra: { link: '', visible: true },
        },
      ],
    },
  };
  page.submit = { method: 'put', url: `/admin/orders/${id}`, label: '儲存' };
  page.after.default = 'edit';
  page.uploadUrl = FORM_UPLOAD_URL;
  return page;
}

export async function respondForm(req: HttpRequest): Promise<HttpResponse> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (req.signal?.aborted) return { status: 0, data: { message: '已取消' } };
  const edit = /^\/admin\/orders\/(\d+)\/edit$/.exec(req.url);
  if (req.method === 'get' && (edit || req.url === '/admin/orders/create')) {
    const page = buildFormPage('stacked', edit ? Number(edit[1]) : 49);
    // Grid routes advertise modal forms; the standalone fixture defaults to page.
    page.presentation = 'modal';
    if (!edit) {
      page.mode = 'create';
      page.title = '新增訂單';
      page.submit = { method: 'post', url: '/admin/orders', label: '儲存' };
    }
    return { status: 200, data: { schemaVersion: SCHEMA_VERSION, page } };
  }
  if (req.method === 'post' && req.url === FORM_UPLOAD_URL && req.body instanceof FormData) {
    const file = req.body.get('file');
    if (!(file instanceof File)) return { status: 422, data: { message: '請選擇檔案。' } };
    return {
      status: 200,
      data: {
        token: `demo-${file.name}`,
        name: file.name,
        size: file.size,
        mime: file.type,
        expiresAt: '2099-01-01T00:00:00Z',
      },
    };
  }
  const record = /^\/admin\/orders\/(\d+)$/.exec(req.url);
  if ((req.method === 'put' && record) || (req.method === 'post' && req.url === '/admin/orders')) {
    const { values } = req.body as FormSubmitRequest;
    if (
      (values.meta as Record<string, unknown> | undefined)?.color === 'error' ||
      values.customer === 'error'
    )
      return {
        status: 422,
        data: {
          message: '請修正欄位。',
          errors:
            values.customer === 'error'
              ? { customer: ['客戶名稱無法使用。'] }
              : { 'meta.color': ['這個顏色目前無法供應。'] },
        },
      };
    const id = record ? Number(record[1]) : 49;
    return {
      status: 200,
      data: {
        id,
        feedback: { toast: { type: 'success', message: '已儲存變更' } },
        urls: {
          list: '/admin/orders',
          edit: `/admin/orders/${id}/edit`,
          create: '/admin/orders/create',
          view: `/admin/orders/${id}`,
        },
      },
    };
  }
  return { status: 404, data: { message: '找不到這個端點。' } };
}
