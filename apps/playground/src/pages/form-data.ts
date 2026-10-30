/** Deterministic fake form endpoints. All demo transport goes through the memory adapter. */
import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import { type FormPage, type FormSubmitRequest, SCHEMA_VERSION } from '@brume-ui/brume-schema';
import fixture from '../../../../packages/schema/fixtures/valid/form-full.json';
import { appendOrder, type OrderDb } from './grid-data';

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

/** A fresh wire snapshot of the same order read by grid reloads. */
export function buildStoredFormPage(
  db: OrderDb,
  layout: 'stacked' | 'horizontal',
  id: number,
): FormPage | null {
  const order = db.orders.find((item) => item.id === id);
  if (!order) return null;
  const page = buildFormPage(layout, id);
  page.values = {
    ...page.values,
    ...structuredClone(order.formValues ?? {}),
    customer: order.customer,
    note: order.note,
    is_gift: order.gift,
    keywords: [...order.tags],
    total: order.items.reduce((sum, item) => sum + item.qty * item.price, 0).toFixed(2),
  };
  return page;
}

export async function respondForm(req: HttpRequest, db: OrderDb): Promise<HttpResponse> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (req.signal?.aborted) return { status: 0, data: { message: '已取消' } };
  const edit = /^\/admin\/orders\/(\d+)\/edit$/.exec(req.url);
  if (req.method === 'get' && (edit || req.url === '/admin/orders/create')) {
    const page = edit
      ? buildStoredFormPage(db, 'stacked', Number(edit[1]))
      : buildFormPage('stacked', db.nextId);
    if (!page) return { status: 404, data: { message: '找不到這筆訂單。' } };
    const basic = page.form.nodes[0];
    if (basic?.type === 'section')
      basic.children.unshift({
        type: 'field',
        field: { type: 'text', name: 'customer', label: '客戶', required: true },
      });
    // Grid routes advertise modal forms; the standalone fixture defaults to page.
    page.presentation = 'modal';
    if (!edit) {
      page.mode = 'create';
      delete page.record;
      page.values.customer = '';
      page.values.note = '';
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
    const existing = record ? db.orders.find((item) => item.id === Number(record[1])) : undefined;
    if (record && !existing) return { status: 404, data: { message: '找不到這筆訂單。' } };
    const order = existing ?? appendOrder(db);
    order.formValues = { ...order.formValues, ...structuredClone(values) };
    if (typeof values.customer === 'string') order.customer = values.customer;
    if (typeof values.note === 'string') order.note = values.note;
    if (typeof values.is_gift === 'boolean') order.gift = values.is_gift;
    if (Array.isArray(values.keywords)) order.tags = values.keywords.map(String);
    const id = order.id;
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
