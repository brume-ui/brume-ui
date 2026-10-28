# 圖表與數字卡

`@brume-ui/brume-react` 內建五個不依賴圖表套件的 SVG 元件：`StatCard`、`Sparkline`、`BarChart`、`LineChart`、`DonutChart`。它們用 Brume 的 token 上色、跟著深淺色切換，用 `ResizeObserver` 隨容器寬度重新排版（高度由 props 固定，所以不會讓版面跳動），也遵守 `prefers-reduced-motion`。

## 共通行為

- **滑過或聚焦都看得到數值。** 每張圖的繪圖區可以用 Tab 移到，方向鍵逐筆移動（←→ 或 ↑↓），Home / End 跳到頭尾，Esc 關掉提示。滑鼠或觸控滑過時，提示會列出該位置的所有數列。
- **圖例可以點。** 兩個以上的數列才有圖例（單一數列由標題說明）。點一下隱藏或顯示該數列，最後一個顯示中的項目不能隱藏。顏色跟著數列走，不會因為隱藏了別的數列而換色。
- **螢幕閱讀器。** 每張圖是一個 `<figure>`，名稱是 `title`，描述是一句摘要（筆數、最低、最高）；圖下有一張視覺上隱藏的資料表，鍵盤移動時用 `aria-live` 唸出目前數值。圖已經放在有標題的 Card 裡時，可以加 `hideTitle`，標題就只給輔助科技用。
- **載入與空資料。** `loading` 會在同樣高度顯示骨架；`data` 是空陣列時顯示「目前沒有資料」，可用 `emptyMessage` 改文字。
- **進場動畫。** 長條從基線長出來，折線和甜甜圈畫出來，總長不超過約 500ms。使用者開啟「減少動態效果」時完全不播；也可以傳 `animate={false}` 關掉。
- **數字格式。** `valueFormat` 給提示和資料表用，`axisFormat` 給座標軸用。兩者都可以是 `Intl.NumberFormatOptions`（例如 `{ style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }`），也可以是函式。沒給 `axisFormat` 時，座標軸用 `valueFormat` 的精簡寫法（`1.2萬`、`1.2K`），語系跟著 `BrumeProvider`。

## 顏色

圖表顏色是 `@brume-ui/brume-tokens` 的 `--br-chart-*`：

| Token                                 | 用途                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| `--br-chart-1` … `--br-chart-8`       | 數列顏色，依序指定，不循環。第 9 個以後請合併成「其他」。      |
| `--br-chart-positive` / `-negative`   | 有好壞意義的值（漲跌）。一定要搭配圖示或正負號，不能只靠顏色。 |
| `--br-chart-muted`                    | 「其他」與淡化的項目。                                         |
| `--br-chart-grid` / `--br-chart-axis` | 格線與基線。                                                   |

順序是色盲安全的關鍵：相鄰兩色在紅色盲、綠色盲模擬下仍分得開，而且每個顏色在淺色和深色卡片上都有 3:1 以上的對比。`packages/tokens/src/chart-palette.test.ts` 會檢查這幾項，改色票時測試會擋下不合格的組合。主色（`--br-accent`）不用在圖表上。

數列預設用它在 `series` 裡的位置當色號；要固定顏色可給 `color: 1`～`8`。在專案自己的 Tailwind 也可以用 `bg-chart-1`、`text-chart-3` 等（匯入 `theme.css` 之後）。

## 元件

```tsx
import { BarChart, DonutChart, LineChart, Sparkline, StatCard } from '@brume-ui/brume-react';

const TWD = { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 } as const;

<StatCard
  label="本月營收"
  value={7200000}
  format={TWD}
  delta={{ value: 0.059, period: '上月' }}   // 0.059 = +5.9%
  trend={[4100000, 4400000, 4900000, 7200000]}
  hint="統計至 10/28 12:00"
/>

// 下降才是好消息的指標（退款率、流失率）
<StatCard label="退款率" value={0.019} format={{ style: 'percent', maximumFractionDigits: 1 }}
  delta={{ value: -0.095, period: '上月', good: 'down' }} />

<LineChart
  title="每日營收"
  data={[{ date: '2026-10-01', online: 41000, store: 29000 } /* … */]}
  xKey="date"
  xType="time"                         // 依時間間距排列；類別軸用預設的 'category'
  series={[{ key: 'online', label: '線上' }, { key: 'store', label: '門市' }]}
  valueFormat={TWD}
/>

<BarChart
  title="分類營收"
  data={[{ category: '服飾', online: 486000, store: 312000 } /* … */]}
  categoryKey="category"
  series={[{ key: 'online', label: '線上' }, { key: 'store', label: '門市' }]}
  layout="stacked"                     // 預設 'grouped'
  orientation="horizontal"             // 名稱長或項目多時用橫向
  valueFormat={TWD}
/>

<DonutChart
  title="訂單狀態"
  data={[{ label: '已完成', value: 1864 }, { label: '待出貨', value: 236 }]}
  centerLabel="筆訂單"                 // 中間總計下方的文字
/>
```

選擇建議：

- 一個數字（加上和上期比較）用 `StatCard`，不要畫只有一根的長條圖。
- 隨時間變化用 `LineChart`。`area` 只建議用在單一數列，多條線疊面積會糊在一起。
- 比較大小用 `BarChart`。`DonutChart` 只適合一眼看占比，超過 6 塊會自動把尾巴合併成「其他」（`maxSlices` 可調）。
- 不要把兩種單位畫在同一張圖（雙 Y 軸）。分成兩張圖。
- 缺值請給 `null`：折線會斷開，資料表顯示「—」。

## 從 brume-laravel 餵資料

階段 1 的 schema 沒有圖表節點，儀表板透過自訂元件使用這些圖表。PHP 端 `->component()` 的陣列會原封不動變成元件的 props，所以所有 props 都設計成 JSON 可以表達的形狀：資料是物件陣列、日期用 ISO 字串、格式用 `Intl.NumberFormatOptions`。

最簡單的做法是直接把 Brume 的元件註冊進去（需要 `brume:install --frontend`）：

```ts
// resources/js/brume/components.ts
import { BarChart, DonutChart, LineChart, StatCard } from '@brume-ui/brume-react';

export const components = { StatCard, LineChart, BarChart, DonutChart };
```

```php
use Brume\Dashboard\Dashboard;

$twd = ['style' => 'currency', 'currency' => 'TWD', 'maximumFractionDigits' => 0];

return Dashboard::make('儀表板')
    ->component('StatCard', [
        'label' => '本月營收',
        'value' => $revenue,
        'format' => $twd,
        'delta' => ['value' => $revenue / $lastMonthRevenue - 1, 'period' => '上月'],
        'trend' => $monthlyRevenue,              // list<int|float>
    ])
    ->component('LineChart', [
        'title' => '每日營收',
        'data' => Order::dailyRevenue()          // [['date' => '2026-10-01', 'online' => 41000, 'store' => 29000], ...]
            ->map(fn ($r) => ['date' => $r->date->toDateString(), 'online' => $r->online, 'store' => $r->store])
            ->all(),
        'xKey' => 'date',
        'xType' => 'time',
        'series' => [['key' => 'online', 'label' => '線上'], ['key' => 'store', 'label' => '門市']],
        'valueFormat' => $twd,
    ])
    ->component('DonutChart', [
        'title' => '訂單狀態',
        'data' => Order::countByStatus()->map(fn ($n, $status) => ['label' => __("order.$status"), 'value' => $n])->values()->all(),
        'centerLabel' => '筆訂單',
    ]);
```

需要把圖放進 Card、組合多張圖、或在前端加工資料時，再包一層自己的元件：

```tsx
// resources/js/brume/components/SalesCard.tsx
import { BarChart, Card, type ChartDatum } from '@brume-ui/brume-react';

export function SalesCard({ rows }: { rows: ChartDatum[] }) {
  return (
    <Card>
      <BarChart
        title="分類營收"
        data={rows}
        categoryKey="category"
        series={[
          { key: 'online', label: '線上' },
          { key: 'store', label: '門市' },
        ]}
        valueFormat={{ style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }}
      />
    </Card>
  );
}
```

PHP 只能傳 JSON，所以 `valueFormat` 要用函式時（例如「1,284 件」），請在這種包裝元件裡寫。自訂元件會另外收到 `context` prop，Brume 的圖表元件會忽略它。
