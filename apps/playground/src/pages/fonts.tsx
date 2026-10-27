import {
  Button,
  Checkbox,
  type DataColumn,
  DataTable,
  Field,
  PasswordInput,
  TextInput,
} from '@herb09638/brume-react';
import { semantic } from '@herb09638/brume-tokens';
import { type CSSProperties, useState } from 'react';

type Scheme = 'light' | 'dark';

interface Order {
  id: string;
  name: string;
  product: string;
  amount: number;
}

const ORDERS: Order[] = [
  { id: '1', name: '王小明', product: '手沖咖啡濾杯組', amount: 1280 },
  { id: '2', name: '林美玲', product: '有機抹茶粉（200 克）', amount: 2450 },
  { id: '3', name: '陳志豪', product: '無線藍牙耳機', amount: 3990 },
  { id: '4', name: '張雅婷', product: '亞麻桌巾（淺灰）', amount: 860 },
  { id: '5', name: '李宗翰', product: '陶瓷馬克杯兩入', amount: 520 },
];

const COLUMNS: DataColumn<Order>[] = [
  { key: 'name', header: '客戶', width: '6rem' },
  { key: 'product', header: '商品' },
  {
    key: 'amount',
    header: '金額',
    numeric: true,
    width: '9rem',
    cell: (r) => `NT$ ${r.amount.toLocaleString('en-US')}`,
  },
];

const FONTS: Array<{ id: string; title: string; family: string }> = [
  {
    id: 'jf',
    title: 'Nunito + jf 粉圓',
    family: '"Nunito", "jf-openhuninn", system-ui, sans-serif',
  },
  {
    id: 'noto',
    title: 'Nunito + Noto Sans TC',
    family: '"Nunito", "Noto Sans TC", system-ui, sans-serif',
  },
  {
    id: 'system',
    title: 'Nunito + 系統字體',
    family: '"Nunito", system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif',
  },
];

/** The dark tokens are declared on :root only, so a wrapper has to set them itself. */
function schemeVars(scheme: Scheme): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [name, values] of Object.entries(semantic)) vars[`--br-${name}`] = values[scheme];
  return { ...vars, colorScheme: scheme } as CSSProperties;
}

function Snippet() {
  const [remember, setRemember] = useState(true);
  return (
    <>
      <DataTable
        columns={COLUMNS}
        rows={ORDERS}
        getRowId={(r) => r.id}
        caption="最近訂單"
        empty={{ title: '沒有訂單', description: '有新訂單時會顯示在這裡。' }}
      />
      <form className="pg-login" onSubmit={(e) => e.preventDefault()}>
        <Field label="帳號" required>
          <TextInput defaultValue="herb" autoComplete="off" />
        </Field>
        <Field label="密碼" required>
          <PasswordInput defaultValue="secret-123" autoComplete="off" />
        </Field>
        <Checkbox checked={remember} onCheckedChange={setRemember} label="記住我" />
        <Button type="submit">登入</Button>
      </form>
    </>
  );
}

export function FontsPage() {
  return (
    <main className="pg-fonts-wrap" data-testid="pg-fonts">
      <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>中文字體比較</h1>
      <p className="pg-lead">
        同一個「訂單列表 + 登入表單」片段，三種字體並排；每欄上方為淺色、下方為深色。
      </p>
      <div className="pg-fonts">
        {FONTS.map((font) => (
          <section
            key={font.id}
            className="pg-font-col"
            data-testid={`pg-font-${font.id}`}
            style={{ fontFamily: font.family }}
          >
            <h2>{font.title}</h2>
            {(['light', 'dark'] as const).map((scheme) => (
              <div
                key={scheme}
                className="pg-scheme-box"
                data-testid={`pg-font-${font.id}-${scheme}`}
                style={schemeVars(scheme)}
              >
                <h3>{scheme === 'light' ? '淺色' : '深色'}</h3>
                <Snippet />
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
