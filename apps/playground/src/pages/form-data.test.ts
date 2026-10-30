import { describe, expect, it } from 'vitest';
import { buildFormPage, respondForm } from './form-data';

describe('playground form server', () => {
  it('serves the full fixture and four page sections with fresh independent values', () => {
    const first = buildFormPage();
    const second = buildFormPage('horizontal');
    expect(first.form.layout).toBe('stacked');
    expect(second.form.layout).toBe('horizontal');
    expect(first.form.nodes.filter((node) => node.type === 'section')).toHaveLength(4);
    first.values.title = 'changed';
    expect(second.values.title).toBe('春季訂單');
  });
  it('loads records, rejects a server-only error, and accepts a corrected submit', async () => {
    const loaded = await respondForm({ method: 'get', url: '/admin/orders/43/edit' });
    expect(loaded.status).toBe(200);
    expect(loaded.data).toMatchObject({ page: { record: { id: 43 } } });
    const rejected = await respondForm({
      method: 'put',
      url: '/admin/orders/42',
      body: { values: { color: 'error', meta: { color: 'error' } }, after: 'edit' },
    });
    expect(rejected).toMatchObject({
      status: 422,
      data: { errors: { 'meta.color': ['這個顏色目前無法供應。'] } },
    });
    const saved = await respondForm({
      method: 'put',
      url: '/admin/orders/42',
      body: { values: { title: '春季訂單', meta: { color: 'blue' } }, after: 'edit' },
    });
    expect(saved).toMatchObject({
      status: 200,
      data: { id: 42, feedback: { toast: { message: '已儲存變更' } } },
    });
  });
  it('returns upload metadata from multipart files and rejects unknown endpoints', async () => {
    const body = new FormData();
    body.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const uploaded = await respondForm({ method: 'post', url: '/admin/orders/upload', body });
    expect(uploaded).toMatchObject({ status: 200, data: { name: 'notes.txt', size: 5 } });
    expect((await respondForm({ method: 'get', url: '/unknown' })).status).toBe(404);
  });
});
