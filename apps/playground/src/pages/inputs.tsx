import {
  BrumeProvider,
  CheckboxGroup,
  Combobox,
  type ComboboxLoader,
  createMemoryAdapter,
  DateInput,
  Field,
  NumberInput,
  QrCode,
  RadioGroup,
  RangeInput,
  type RangeValue,
  SearchInput,
  Tabs,
  TagsInput,
  type UploadItem,
  UploadList,
  useBrume,
} from '@brume-ui/brume-react';
import type { OptionItem } from '@brume-ui/brume-schema';
import { useMemo, useState } from 'react';
import { FORM_UPLOAD_URL, respondForm } from './form-data';
import { createOrderDb } from './grid-data';
import { Page, Panel, Section } from './page';

const CITIES: OptionItem[] = [
  { value: 'tpe', label: '台北市', group: '北部' },
  { value: 'ntpc', label: '新北市', group: '北部' },
  { value: 'tyn', label: '桃園市', group: '北部' },
  { value: 'txg', label: '台中市', group: '中部' },
  { value: 'tnn', label: '台南市', group: '南部' },
  { value: 'khh', label: '高雄市', group: '南部', description: '直轄市' },
];

const USERS: OptionItem[] = Array.from({ length: 45 }, (_, i) => ({
  value: String(i + 1),
  label: `使用者 ${String(i + 1).padStart(2, '0')}`,
}));

/** Fake remote source: 10 per page, 400ms latency. */
const loadUsers: ComboboxLoader = ({ q, page }) =>
  new Promise((resolve) => {
    const hits = USERS.filter((u) => u.label.includes(q));
    setTimeout(
      () =>
        resolve({
          options: hits.slice((page - 1) * 10, page * 10),
          hasMore: hits.length > page * 10,
        }),
      400,
    );
  });
const resolveUsers = async (values: string[]) => USERS.filter((u) => values.includes(u.value));

const TAG_SUGGESTIONS = [
  { value: 'new', label: '新品' },
  { value: 'sale', label: '特價' },
  { value: 'limited', label: '限量' },
];

const TABS = [
  { key: 'basic', label: '基本資料' },
  { key: 'price', label: '價格', badge: 'error' as const },
  { key: 'stock', label: '庫存' },
];

const STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '上架' },
  { value: 'archived', label: '封存' },
];

export function InputsPage() {
  const { locale } = useBrume();
  const adapter = useMemo(() => {
    const db = createOrderDb();
    return createMemoryAdapter('/inputs', { respond: (req) => respondForm(req, db) });
  }, []);
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <InputsContent />
    </BrumeProvider>
  );
}
function InputsContent() {
  const { adapter } = useBrume();
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState<string | string[]>('txg');
  const [cities, setCities] = useState<string | string[]>(['tpe', 'khh']);
  const [users, setUsers] = useState<string | string[]>(['3']);
  const [status, setStatus] = useState('published');
  const [channels, setChannels] = useState<string[]>(['draft']);
  const [date, setDate] = useState('2026-10-28');
  const [dateTime, setDateTime] = useState('2026-10-28T09:30');
  const [price, setPrice] = useState<RangeValue>({ start: '100' });
  const [created, setCreated] = useState<RangeValue>({});
  const [amount, setAmount] = useState('1280.50');
  const [qty, setQty] = useState('12');
  const [tags, setTags] = useState<string[]>(['new', '夏季']);
  const [freeTags, setFreeTags] = useState<string[]>([]);
  const [tab, setTab] = useState('basic');
  return (
    <Page
      name="inputs"
      title="Inputs"
      lead="SearchInput, Combobox, RadioGroup, CheckboxGroup, DateInput, RangeInput, NumberInput, TagsInput, Tabs and QrCode."
    >
      <Section title="search">
        <Panel>
          <div className="pg-stack">
            <SearchInput value={search} onSearch={setSearch} placeholder="搜尋" label="搜尋商品" />
            <span data-testid="search-result">送出：「{search}」</span>
          </div>
        </Panel>
      </Section>
      <Section title="combobox">
        <Panel>
          <div className="pg-stack">
            <Field label="城市">
              <Combobox
                label="城市"
                options={CITIES}
                value={city}
                onChange={setCity}
                placeholder="選擇城市"
              />
            </Field>
            <Field label="城市（多選）">
              <Combobox
                label="城市（多選）"
                multiple
                options={CITIES}
                value={cities}
                onChange={setCities}
              />
            </Field>
            <Field label="負責人（遠端）">
              <Combobox
                label="負責人（遠端）"
                multiple
                load={loadUsers}
                resolveLabels={resolveUsers}
                value={users}
                onChange={setUsers}
                placeholder="輸入名稱搜尋"
              />
            </Field>
          </div>
        </Panel>
      </Section>
      <Section title="radio + checkbox groups">
        <Panel>
          <div className="pg-stack">
            <p className="pg-label">狀態</p>
            <RadioGroup label="狀態" options={STATUS} value={status} onChange={setStatus} />
            <p className="pg-label">顯示於</p>
            <CheckboxGroup
              label="顯示於"
              options={STATUS}
              value={channels}
              onChange={setChannels}
              orientation="vertical"
            />
          </div>
        </Panel>
      </Section>
      <Section title="dates + ranges">
        <Panel>
          <div className="pg-stack">
            <Field label="上架日">
              <DateInput label="上架日" value={date} onChange={setDate} />
            </Field>
            <Field label="預約時間">
              <DateInput label="預約時間" withTime value={dateTime} onChange={setDateTime} />
            </Field>
            <p className="pg-label">價格</p>
            <RangeInput label="價格" of="number" value={price} onChange={setPrice} />
            <p className="pg-label">建立日期</p>
            <RangeInput label="建立日期" of="date" value={created} onChange={setCreated} />
          </div>
        </Panel>
      </Section>
      <Section title="number + tags">
        <Panel>
          <div className="pg-stack">
            <Field label="售價" description="失焦時補齊兩位小數並加上千分位">
              <NumberInput
                value={amount}
                onChange={setAmount}
                decimals={2}
                prefix="NT$"
                grouping
                min={0}
              />
            </Field>
            <span data-testid="number-wire">送出：「{amount}」</span>
            <Field label="數量">
              <NumberInput value={qty} onChange={setQty} decimals={0} min={0} />
            </Field>
            <Field label="標籤" description="最多 5 個">
              <TagsInput
                label="標籤"
                options={TAG_SUGGESTIONS}
                value={tags}
                onChange={setTags}
                max={5}
                maxLength={20}
              />
            </Field>
            <Field label="關鍵字">
              <TagsInput label="關鍵字" value={freeTags} onChange={setFreeTags} />
            </Field>
          </div>
        </Panel>
      </Section>
      <Section title="tabs">
        <Panel>
          <Tabs label="商品" items={TABS} value={tab} onValueChange={setTab}>
            {(key) => (
              <p className="pg-label">「{TABS.find((t) => t.key === key)?.label}」的欄位</p>
            )}
          </Tabs>
        </Panel>
      </Section>
      <Section title="uploads">
        <Panel>
          <UploadList
            label="附件"
            kind="file"
            multiple
            sortable
            accept={['text/plain', 'application/pdf']}
            maxSize={10485760}
            items={files}
            onItemsChange={setFiles}
            upload={async (file, signal) => {
              const body = new FormData();
              body.set('file', file);
              const response = await adapter.request<
                import('@brume-ui/brume-schema').UploadTempResponse
              >({ method: 'post', url: FORM_UPLOAD_URL, body, signal });
              return response.status === 200
                ? { ok: true, value: response.data }
                : { ok: false, message: '上傳失敗，請再試一次。' };
            }}
          />
        </Panel>
      </Section>
      <Section title="qr code">
        <Panel>
          <QrCode value="https://brume.dev/orders/42" label="訂單 42 的 QR Code" />
        </Panel>
      </Section>
    </Page>
  );
}
