import {
  CheckboxGroup,
  Combobox,
  type ComboboxLoader,
  DateInput,
  Field,
  QrCode,
  RadioGroup,
  RangeInput,
  type RangeValue,
  SearchInput,
} from '@brume-ui/brume-react';
import type { OptionItem } from '@brume-ui/brume-schema';
import { useState } from 'react';
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

const STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '上架' },
  { value: 'archived', label: '封存' },
];

export function InputsPage() {
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
  return (
    <Page
      name="inputs"
      title="Inputs"
      lead="SearchInput, Combobox, RadioGroup, CheckboxGroup, DateInput, RangeInput and QrCode."
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
      <Section title="qr code">
        <Panel>
          <QrCode value="https://brume.dev/orders/42" label="訂單 42 的 QR Code" />
        </Panel>
      </Section>
    </Page>
  );
}
