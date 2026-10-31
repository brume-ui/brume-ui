import { createMemoryAdapter, type HttpRequest, type HttpResponse } from '@brume-ui/brume-react';
import { collectValueFields, getAt, setAt } from '@brume-ui/brume-renderer';
import type { FormSubmitRequest, PickerSearchResponse } from '@brume-ui/brume-schema';
import type { buildFocusedFixture } from './form-feature-fixtures';
export type Reply = 'success' | 'server422' | 'cancel' | 'network';
export interface Store {
  saved: Record<string, unknown>;
  wire: Record<string, unknown>;
  requests: number;
  uploads: number;
  aborted: number;
  hydrateBatches: number[];
  pendingOptions: number;
  currentId: string;
  nextId: number;
  feedback?: string;
  revision: number;
  listeners: Set<() => void>;
}
export function createFocusedAdapter(
  exampleId: string,
  fixture: ReturnType<typeof buildFocusedFixture>,
  controls: { current: { reply: Reply; slow: boolean; uploadFailure: boolean } },
  store: { current: Store },
  changed: () => void,
) {
  return createMemoryAdapter('/demo/focused/edit', {
    respond: async (req: HttpRequest): Promise<HttpResponse> => {
      const current = controls.current;
      if (req.method === 'get' && req.url === '/demo/focused/stored')
        return { status: 200, data: structuredClone(store.current.saved) };
      if (req.method === 'get' && req.url === '/demo/focused/options') {
        store.current.pendingOptions++;
        changed();
        const ids = req.query?.value;
        const batch = Array.isArray(ids) ? ids.map(String) : undefined;
        if (batch) {
          store.current.hydrateBatches.push(batch.length);
          changed();
        }
        // Deliberately finish late even after abort. The renderer owns response lifetime checks.
        await delay(current.slow ? 1400 : 30);
        store.current.pendingOptions--;
        changed();
        if (batch && batch.length > 100)
          return { status: 422, data: { message: '每次最多解析100項。' } };
        const q = String(req.query?.q ?? '').toLowerCase();
        const page = Number(req.query?.page ?? 1);
        const all = Array.from({ length: 110 }, (_, i) => ({
          value: String(i + 1),
          label: `商品 ${i + 1}`,
          authority: {
            values: { note: `商品 ${i + 1} 權威備註`, locked: `權威 ${i + 1}` },
            rowFields: [
              {
                row: [{ path: 'selection', key: String(i + 1), id: String(i + 1) }],
                fields: {
                  note: {
                    readOnly: i === 0,
                    rules: [{ rule: 'required' as const, message: '商品備註必填。' }],
                  },
                  locked: { readOnly: true, rules: [] },
                },
              },
            ],
          },
        }));
        const filtered = all.filter((item) =>
          batch ? batch.includes(item.value) : item.label.toLowerCase().includes(q),
        );
        const data: PickerSearchResponse = {
          data: batch ? filtered : filtered.slice((page - 1) * 10, page * 10),
          pagination: {
            page,
            perPage: batch?.length || 10,
            hasMore: !batch && filtered.length > page * 10,
          },
        };
        return { status: 200, data };
      }
      if (
        req.method === 'post' &&
        req.url === '/demo/focused/upload' &&
        req.body instanceof FormData
      ) {
        store.current.uploads++;
        changed();
        let counted = false;
        const aborted = () => {
          if (!counted) {
            counted = true;
            store.current.aborted++;
            changed();
          }
        };
        req.signal?.addEventListener('abort', aborted, { once: true });
        await delay(current.slow ? 1400 : 120);
        req.signal?.removeEventListener('abort', aborted);
        if (req.signal?.aborted) {
          aborted();
          return { status: 0, data: { message: '已取消上傳。' } };
        }
        if (current.uploadFailure)
          return { status: 503, data: { message: '模擬上傳失敗，請移除後重選。' } };
        const file = req.body.get('file');
        if (!(file instanceof File)) return { status: 422, data: { message: '缺少檔案。' } };
        return {
          status: 200,
          data: {
            token: `focused-${store.current.uploads}-${file.name}`,
            name: file.name,
            size: file.size,
            mime: file.type,
            ...(file.type.startsWith('image/') ? { previewUrl: '/demo/order-package.svg' } : {}),
            expiresAt: '2099-01-01T00:00:00Z',
          },
        };
      }
      if (req.url === '/demo/focused/save') {
        const { values } = req.body as FormSubmitRequest;
        store.current.wire = structuredClone(values);
        store.current.requests++;
        changed();
        await delay(current.slow ? 1400 : 80);
        if (current.reply === 'network') throw new Error('模擬網路中斷');
        if (current.reply === 'cancel') {
          store.current.feedback = '已取消；草稿仍在。';
          changed();
          return {
            status: 200,
            data: {
              cancelled: true,
              feedback: { toast: { type: 'info', message: '已取消；草稿仍在。' } },
            },
          };
        }
        if (current.reply === 'server422')
          return {
            status: 422,
            data: {
              errors: {
                [exampleId === 'form.behavior.client-rule-message' ? 'required' : 'name']: [
                  '此名稱已被使用。',
                ],
              },
            },
          };
        let accepted = structuredClone(values);
        if (
          exampleId.startsWith('form.condition.') ||
          [
            'form.behavior.enable-when',
            'form.behavior.conditions-row',
            'form.behavior.condition-invalid-control',
          ].includes(exampleId)
        )
          accepted = acceptConditionalDraft(
            fixture,
            values,
            Object.keys(store.current.saved).length ? store.current.saved : fixture.values,
          );
        if (typeof accepted.name === 'string') accepted.name = accepted.name.trim();
        if (exampleId === 'form.behavior.readonly-disabled')
          for (const key of ['readonly', 'disabled', 'display'])
            accepted[key] = fixture.values[key];
        if (exampleId.includes('custom')) delete accepted.display;
        if (exampleId === 'form.behavior.default-value')
          accepted = acceptConditionalDraft(
            fixture,
            values,
            Object.keys(store.current.saved).length ? store.current.saved : fixture.values,
          );
        if (req.method === 'post') store.current.currentId = String(store.current.nextId++);
        store.current.saved = accepted;
        delete store.current.feedback;
        return {
          status: 200,
          data: {
            id: store.current.currentId,
            urls: {
              list: '/demo/focused/list',
              edit: '/demo/focused/edit',
              create: '/demo/focused/create',
              view: '/demo/focused/view',
            },
          },
        };
      }
      return { status: 404, data: { message: '示範端點不存在。' } };
    },
  });
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Local acceptance fixture only: inactive declarations use the last stored snapshot, not hidden drafts. */
function acceptConditionalDraft(
  fixture: ReturnType<typeof buildFocusedFixture>,
  values: Record<string, unknown>,
  baseline: Record<string, unknown>,
) {
  const fields = collectValueFields(
    fixture.form.nodes,
    values,
    undefined,
    fixture.form.rowFields,
    (field) => ({
      known: true,
      value: getAt(baseline, field.path) ?? field.def.defaultValue ?? null,
    }),
  );
  let accepted: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.rowContext.length) continue;
    const value = field.active ? field.effectiveValue : getAt(baseline, field.path);
    if (value !== undefined) accepted = setAt(accepted, field.path, structuredClone(value));
  }
  return accepted;
}
