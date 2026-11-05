# 不搭 Laravel 單獨使用 brume-ui

brume-ui 不綁後端。Laravel（brume-laravel + `@brume-ui/brume-inertia`）只是其中一種接法。依需要選一層：

| 用法                     | 套件                                   | 後端                          |
| ------------------------ | -------------------------------------- | ----------------------------- |
| 只用元件                 | `brume-tokens`、`brume-react`          | 不需要；資料用 React state 管 |
| 用 JSON 畫整頁列表／表單 | 再加 `brume-schema`、`brume-renderer`  | 任何語言，只要回應符合協定    |
| Laravel 全套             | 再加 `brume-inertia` + `brume/laravel` | Laravel                       |

元件不會直接打網路。換頁、表單送出、遠端選項、上傳、動作都透過 `<BrumeProvider adapter>` 收到的 adapter。內建三種：

- `createInertiaAdapter()`（`brume-inertia`）：Inertia／Laravel。
- `createFetchAdapter()`（`brume-react`）：任何後端、任何前端路由，用 `fetch` 溝通。
- `createMemoryAdapter()`（`brume-react`）：不打網路，給只用元件、測試或 playground。

## 1. 只用元件

```tsx
import '@brume-ui/brume-tokens/tokens.css';
import '@brume-ui/brume-react/styles.css';
import {
  BrumeProvider,
  Button,
  ConfirmHost,
  Toaster,
  createMemoryAdapter,
} from '@brume-ui/brume-react';

const adapter = createMemoryAdapter();

export function App() {
  return (
    <BrumeProvider adapter={adapter} locale="zh-TW">
      <Button onClick={() => alert('hi')}>按我</Button>
      <ConfirmHost />
      <Toaster />
    </BrumeProvider>
  );
}
```

`Link`、側欄這類會「換頁」的元件會呼叫 `adapter.visit`。用記憶體 adapter 時只會記下網址，不會真的換頁；要真的換頁，請改用下面的 `createFetchAdapter`。

## 2. 用 JSON 畫整頁（任何後端）

```tsx
import '@brume-ui/brume-tokens/tokens.css';
import '@brume-ui/brume-react/styles.css';
import '@brume-ui/brume-renderer/styles.css';
import { BrumeProvider, ConfirmHost, Toaster, createFetchAdapter } from '@brume-ui/brume-react';
import { BrumeRemotePage, RegistryProvider, createRegistry } from '@brume-ui/brume-renderer';
import { createRoot } from 'react-dom/client';

const adapter = createFetchAdapter();
const registry = createRegistry({ mode: 'precompiled' });

createRoot(document.getElementById('app')!).render(
  <BrumeProvider adapter={adapter} locale="zh-TW">
    <RegistryProvider registry={registry}>
      <BrumeRemotePage
        pageUrl={(url) => `/api/pages${url}`}
        onPage={(envelope) => {
          document.title = envelope.page.title;
        }}
      />
    </RegistryProvider>
    <ConfirmHost />
    <Toaster />
  </BrumeProvider>,
);
```

`BrumeRemotePage` 會在掛載時，以及每次 `visit`、`reload`、瀏覽器上一頁／下一頁時，對 `pageUrl(目前網址)` 發 `GET`，拿到 page envelope 就畫出來。行為跟 Inertia 一樣：新頁面到之前舊頁面留著；沒帶 `preserveState` 的換頁會重置頁面狀態；沒帶 `preserveScroll` 的換頁會捲回頂端；較慢的舊請求晚到也不會蓋掉新頁面。不給 `pageUrl` 時就打同一個網址（請求帶 `Accept: application/json`），適合同一路徑依 Accept 回 HTML 或 JSON 的後端。

外框（側欄、頂欄、麵包屑）請用 `brume-react` 的 `AppShell` 自己包在外面；選單資料由你的 App 決定。

### 後端要提供什麼

協定的 JSON Schema 在 [`packages/schema/schema/v0.json`](../packages/schema/schema/v0.json)，TypeScript 型別由 `@brume-ui/brume-schema` 匯出。最少要有：

| 請求                                      | 回應                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET pageUrl(網址)`                       | `PageEnvelope`：`{ "schemaVersion": "0.x.y", "page": { "type": "list" \| "form" \| "dashboard" \| "error", ... } }`。404／403 可以回 `type: "error"` 的 envelope，會當成頁面顯示 |
| 表單 `page.submit.url`                    | 成功：`FormSubmitResponse`；驗證失敗：**422** `{ "message": "...", "errors": { "meta.color": ["必填"] } }`，鍵是值的點路徑                                                       |
| 列表 `endpoints.action`／`endpoints.cell` | `ActionResponse`／`CellUpdateResponse`，可帶 `feedback`（toast、redirect、refresh、download）                                                                                    |
| 遠端選項、關聯挑選、上傳                  | 欄位定義裡宣告的網址，回 `OptionsResponse`、`PickerSearchResponse`、`UploadTempResponse`                                                                                         |

只實作你的頁面實際用到的端點即可；例如沒有上傳欄位，就不需要上傳端點。其他錯誤（4xx／5xx）回 `{ "message": "..." }`，畫面會用這段文字提示。

### 驗證與 CSRF

預設的 `request` 是 `fetchJson`：同源、帶 cookie（`credentials: 'same-origin'`），有 `XSRF-TOKEN` cookie 時會帶 `X-XSRF-TOKEN` 標頭。API 在別的網域，或要用 Bearer token，就自己傳 `request`：

```ts
const adapter = createFetchAdapter({
  async request(req) {
    const res = await fetch(`https://api.example.com${req.url}`, {
      method: req.method.toUpperCase(),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: req.method === 'get' ? undefined : JSON.stringify(req.body),
      signal: req.signal,
    }).catch((error) => ({ error }));
    if ('error' in res) return { status: 0, data: { message: String(res.error) } };
    return { status: res.status, data: await res.json().catch(() => ({})) };
  },
});
```

自己寫時要遵守三點：不論狀態碼都 resolve；網路錯誤回 `status: 0`；`body` 是 `FormData`（上傳）時要原樣送出，不要 `JSON.stringify`，也不要自己設 `Content-Type`。上面的範例為了簡短沒處理 `req.query` 和 `FormData`，實際使用請補上。

### 搭配 React Router 等前端路由

預設用 `history.pushState` 改網址。已經有路由器時，把它的導航交給 adapter：

```tsx
const navigate = useNavigate();
const adapter = useMemo(
  () => createFetchAdapter({ navigate: (url, { replace }) => navigate(url, { replace }) }),
  [navigate],
);
```

### 已知限制

- 上一頁／下一頁無法取消，所以表單「有未儲存的變更」的確認不會在這時出現；站內連結和關閉分頁仍會確認。
- `adapter.submit`（目前只有登出選單用）成功後若回應帶 `feedback.redirect` 或 `redirect`，會前往該網址；422 會把每個欄位的第一則錯誤交給 `onError`。

## 3. Laravel 全套

見 brume-laravel 的 README。
