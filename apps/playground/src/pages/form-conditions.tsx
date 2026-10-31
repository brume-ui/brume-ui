import { BrumeProvider, Button, useBrume } from '@brume-ui/brume-react';
import {
  FormView,
  type FormViewHandle,
  useFormState,
  useFormSubmit,
} from '@brume-ui/brume-renderer';
import type { FormDef, FormPage } from '@brume-ui/brume-schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DemoGuide } from './demo-guide';
import { createGiftMemory, giftForm, giftValues } from './gift-demo';
import { Page, Panel } from './page';

export function FormConditionsPage() {
  const { locale } = useBrume();
  const memory = useMemo(() => createGiftMemory(giftForm, giftValues()), []);
  return (
    <BrumeProvider locale={locale} adapter={memory.adapter}>
      <Page
        name="form-conditions"
        title="條件式贈品設定"
        lead="商品、優惠券與點數只作設定示範，沒有發券、兌換或點數入帳。"
      >
        <DemoGuide featureId="gift.root-three-branches">
          <GiftForm form={giftForm} initial={memory.store.saved} />
        </DemoGuide>
      </Page>
    </BrumeProvider>
  );
}

/** Explicit app-layer canonical reload; public useFormSubmit still resets the submitted draft. */
export function GiftForm({
  form,
  initial,
  composition = false,
}: {
  form: FormDef;
  initial: Record<string, unknown>;
  composition?: boolean;
}) {
  const { adapter } = useBrume();
  const api = useFormState(form, initial);
  const view = useRef<FormViewHandle>(null);
  const current = useRef(api);
  current.current = api;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Public defaultValue is authority fallback, not draft initialization. Initialize only newly
  // added threshold owners, using their current walker paths; existing invalid types stay invalid.
  useEffect(() => {
    for (const item of api.fields)
      if (
        item.def.name === 'gift_type' &&
        api.getValue(item.path) === undefined &&
        item.rowContext.length
      )
        api.setValue(item.path, 'product');
  }, [api]);
  const page: FormPage = {
    type: 'form',
    title: '贈品設定',
    name: '示範',
    formId: composition ? 'composition' : 'gift',
    mode: 'edit',
    record: { id: 'gift-demo' },
    form,
    values: initial,
    submit: { method: 'put', url: '/gift/save', label: '儲存' },
    after: { options: ['edit'], default: 'edit' },
    presentation: 'page',
    size: 'lg',
  };
  const { submit, submitting } = useFormSubmit(page, api, view);
  const [saved, setSaved] = useState<Record<string, unknown>>();
  const [wire, setWire] = useState<Record<string, unknown>>();
  const [message, setMessage] = useState('尚未儲存');
  async function save() {
    const draft = api.values;
    const state = api.stateId;
    const result = await submit('edit');
    if (
      !result ||
      !mounted.current ||
      current.current.stateId !== state ||
      current.current.values !== draft
    )
      return;
    const generation = api.resetVersion;
    const loaded = await adapter.request<Record<string, unknown>>({
      method: 'get',
      url: '/gift/stored',
    });
    if (
      !mounted.current ||
      current.current.stateId !== state ||
      api.resetVersion !== generation ||
      current.current.values !== draft ||
      loaded.status !== 200
    )
      return;
    api.reset(loaded.data);
    setSaved(loaded.data);
    setWire(draft);
    setMessage('已儲存並載入完整基準');
  }
  return (
    <Panel>
      <p>
        切換類型會保留尚未儲存的草稿。只驗證目前分支；成功儲存會載入完整記憶體基準，隱藏分支還原既存資料。重設會捨棄未儲存變更。優惠券與點數僅為設定，沒有實際發放。
      </p>
      <FormView ref={view} form={form} api={api} />
      <Button disabled={submitting} onClick={() => void save()}>
        {composition ? 'Save composition' : '儲存贈品設定'}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          api.reset();
          setMessage('已重設至儲存基準');
        }}
      >
        重設贈品草稿
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          const type = api.fields.find((field) => field.def.name === 'gift_type');
          if (type) api.setValue(type.path, 'invalid-gift');
        }}
      >
        載入無效贈品類型
      </Button>
      <p role="status">{message}</p>
      <p data-testid="gift-dirty">{api.dirty ? '有未儲存變更' : '無未儲存變更'}</p>
      <details>
        <summary>草稿、送出與已存值（記憶體）</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <output data-testid="gift-draft">{JSON.stringify(api.values, null, 2)}</output>
        </pre>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <output data-testid="gift-wire">{JSON.stringify(wire ?? {}, null, 2)}</output>
        </pre>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <output data-testid={composition ? 'composition-saved' : 'gift-saved'}>
            {JSON.stringify(saved ?? {}, null, 2)}
          </output>
        </pre>
      </details>
    </Panel>
  );
}
