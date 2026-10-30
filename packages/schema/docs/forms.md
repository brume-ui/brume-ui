# Brume 表單協定

表單頁是 `page.type === 'form'` 的 `PageEnvelope`（`FormPage`）。本文件說明前端與伺服器之間的約定，與後端實作無關。型別定義在 `schema/v0.json` 的 `$defs`；其他端點與狀態碼見 [protocol.md](./protocol.md)。

端點網址一律來自 schema：`page.submit.url`、`page.uploadUrl`、`ListPage.resource.*`、`ListPage.quickCreate.submitUrl`。前端不自行拼路徑，`{id}` 佔位字的值用 `encodeURIComponent` 編碼。

## 兩種呈現，同一份定義

表單可以是整頁（`presentation: 'page'`），也可以是列表上的彈窗（`'modal'`）。兩者取得的是同一份 `FormPage`：

- 整頁：一般的頁面導覽，打開新增或編輯頁的網址。
- 彈窗：`GET <新增或編輯頁的網址>`，帶標頭 `X-Brume-Form: 1`（常數 `FORM_HEADER`，值固定為 `'1'`）。回應是 `PageEnvelope`，`page.type === 'form'`。

網址來自 `ListPage.resource.createUrl` 與 `ListPage.resource.editUrl`（含 `{id}`），`resource.presentation` 決定列表上用哪一種。

彈窗的請求和其他 API 請求一樣帶 `Accept: application/json`（見 [protocol.md 的請求](./protocol.md#請求)）。回應：

| 狀態碼 | 回應                                           |
| ------ | ---------------------------------------------- |
| 200    | JSON 的 `PageEnvelope`，`page.type === 'form'` |
| 401    | 未登入，`ErrorResponse`                        |
| 403    | 不允許，`ErrorResponse`                        |
| 404    | 編輯的資料不在範圍內，`ErrorResponse`          |

同一個網址會依標頭回傳不同的內容，所以伺服器在**兩種**回應上都要帶 `Vary: X-Brume-Form`：帶標頭的 JSON 回應，以及不帶標頭的一般頁面回應，避免快取混用。

## 值與路徑

表單的值（`FormPage.values`、`FormSubmitRequest.values`）是一個巢狀物件：

- 欄位的 `name` 是相對於所在容器的鍵。`embeds` 節點會加一層前綴，它底下的值是 `name` 底下的物件。
- 路徑用點分隔，陣列索引是數字段，與 Laravel 的驗證鍵相同：`meta.color`、`images.2.extra.link`、`conditions.1.actions.0.freebies.3.given_limit`。

線上的值格式：

| 欄位                                                   | 值                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `text`、`textarea`、`email`、`url`、`mobile`、`hidden` | string（空值為 `''`）                                         |
| `display`                                              | 只供顯示；前端不送，伺服器收到也忽略                          |
| `date`                                                 | `YYYY-MM-DD`                                                  |
| `datetime`                                             | `YYYY-MM-DDTHH:mm`（與原生 `datetime-local` 相同）            |
| `dateRange`、`datetimeRange`                           | `{ start?, end? }`，各自用上面的格式                          |
| `number`                                               | JSON number 或 `null`                                         |
| `decimal`、`currency`                                  | 固定小數位數的字串（例如 `"1280.50"`）或 `null`，避免浮點誤差 |
| `switch`                                               | boolean                                                       |
| `select`、`radio`                                      | string 或 `null`                                              |
| `multipleSelect`、`checkbox`、`tags`                   | `string[]`                                                    |
| `upload`（單檔）                                       | `UploadValue \| null`                                         |
| `upload`（多檔）                                       | `UploadValue[]`，陣列順序就是排序                             |
| `embeds`                                               | 物件                                                          |
| `password`                                             | 載入時一律是 `''`；送出 `''` 表示不修改                       |

## 送出

`page.submit.method` 為 `post`（新增）或 `put`（更新），對 `page.submit.url` 送出 `FormSubmitRequest`：

```json
{ "values": { "title": "春季特賣", "meta": { "color": "#ff0000" } }, "after": "edit" }
```

`after` 是使用者在「儲存後」選單選的去向，取自 `page.after.options`。

| 狀態碼 | 意義                          |
| ------ | ----------------------------- |
| 200    | 成功，回 `FormSubmitResponse` |
| 401    | 未登入                        |
| 403    | 不允許                        |
| 404    | 編輯的資料不在範圍內          |
| 419    | CSRF 逾時                     |
| 422    | 驗證錯誤，`ErrorResponse`     |

422 的 `ErrorResponse.errors` 的鍵是值的路徑，相對於 `values` 的根，不加 `values.` 前綴：

```json
{
  "message": "有 2 個欄位需要修正",
  "errors": {
    "meta.color": ["顏色格式不正確。"],
    "images.2.extra.link": ["連結格式不正確。"]
  }
}
```

前端把每個鍵對應到欄位，顯示在欄位下方。找不到對應欄位的鍵（例如伺服器 hook 丟出的 `total`）不能丟掉，由前端放進表單頂端的錯誤摘要。

### 伺服器如何處理送出的值

前端會把整個值物件送回，所以伺服器必須自己決定哪些鍵可以寫入：

- 只寫入表單宣告過、可編輯的欄位。沒有宣告的鍵、`readOnly` 欄位、`display` 欄位一律忽略，不寫入，也不回錯誤。
- `password` 送出 `''` 表示不修改（新增時即為不設定），不寫入；需要必填時由 `required` 規則處理。

載入時（`FormPage.values`）：

- 只輸出宣告過的欄位。
- 欄位對應到不可公開的屬性（例如 Laravel model 的 `$hidden`）時輸出 `null`，除非欄位宣告了取值的 closure（例如 `value()`），此時輸出 closure 的結果。
- `password` 一律輸出 `''`。

### 儲存後去向

成功時回 `FormSubmitResponse`：

```json
{
  "id": 12,
  "feedback": { "toast": { "type": "success", "message": "已新增訂單" } },
  "urls": {
    "list": "/admin/orders",
    "edit": "/admin/orders/12/edit",
    "create": "/admin/orders/create"
  }
}
```

前端依使用者選的 `after` 和 `urls` 決定下一步：`list` 回到列表、`edit` 繼續編輯這筆、`create` 繼續新增、`view` 查看。

- `urls.edit` 一定存在。`page.after.options` 裡的每個選項，伺服器都必須在 `urls` 提供對應的網址（`after: 'list'` 要有 `urls.list`，以此類推）。
- 對應的網址不存在時（伺服器的錯誤），前端退回 `urls.edit`。
- `feedback.redirect` 存在時以它為準，不看 `after`。

成功 toast：`feedback.toast` 存在時顯示它，**取代**前端預設的「已新增{name}」（新增）或「已儲存變更」（編輯），不會出現兩個 toast；不存在時顯示預設的。`feedback` 的其他欄位照 [protocol.md 的回饋](./protocol.md#回饋feedback) 處理。

## 上傳生命週期

`page.uploadUrl` 由伺服器依表單產生：它識別這個表單，編輯時也識別這筆資料（例如 `/admin/orders/12/_brume/upload`）。上傳請求帶檔案、欄位路徑及 row context，表單與資料由網址決定；0.4.0 的巢狀 context 規則見下節。

1. 使用者選了檔案，前端立即 `POST page.uploadUrl`，multipart 帶 `file`（檔案）和 `field`（欄位的完整值路徑，例如 `images` 或 `gallery.cover`）。參數名稱定義在 `UPLOAD_PARAMS`。一次一個檔案。伺服器回 `UploadTempResponse`。
2. 伺服器把 token 綁定到：上傳的使用者、`uploadUrl` 識別的表單（編輯時含這筆資料）、`field` 的 canonical binding 及 verified row-key chain（巢狀 row 規則見下節）。
3. 送出表單時：
   - 新檔案以 `{ token, extra }` 送出。
   - 舊檔案以載入時拿到的 `{ path, url, extra }` 原樣送回。
4. 伺服器在送出時檢查每個 token：使用者、表單（與資料）、欄位路徑都要與這次送出相符，而且還沒過 `expiresAt`。通過後把暫存檔歸檔。
5. 伺服器只接受這筆資料這個欄位目前存著的 `path`，並刪除原本有、但這次沒有送回的舊檔。刪除的路徑只來自伺服器自己的資料，不使用客戶端傳來的路徑。
6. 過了 `expiresAt` 還沒被歸檔的暫存檔會被清除。

多檔上傳的陣列順序就是排序。`UploadValue` 的兩種形狀互斥：不允許其他屬性，所以同時帶 `token` 與 `path` 的值不合法。

### 上傳的錯誤

上傳端點（`POST page.uploadUrl`）：

| 狀況                                     | 回應                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| 檔案格式不在欄位的 `accept` 內           | 422，鍵 `file`                                             |
| 檔案超過欄位的 `maxSize`                 | 422，鍵 `file`                                             |
| 請求超過伺服器或代理的大小上限           | 413（body 可能不是 JSON），前端當成檔案超過 `maxSize` 處理 |
| `field` 不是這個表單宣告過的 upload 欄位 | 422，鍵 `field`                                            |

送出表單時（`page.submit.url`），鍵是值的路徑：

| 狀況                                                    | 422 的鍵                                        |
| ------------------------------------------------------- | ----------------------------------------------- |
| 檔案數超過 `maxFiles`                                   | 欄位路徑，例如 `images`                         |
| token 無效、過期，或屬於別的使用者、表單、資料、欄位    | 那個值的路徑：多檔為 `images.2`，單檔為 `cover` |
| `path` 不是這筆資料這個欄位目前存著的檔案（偽造的路徑） | 同上                                            |
| `extra` 的欄位驗證失敗                                  | `images.2.extra.link`                           |

這些情況都不會移動或刪除任何檔案。

## 前端驗證（`ClientRule`）

伺服器是唯一的權威。前端只先檢查 `FieldDef.rules` 裡的子集，`message` 由伺服器以與 422 同一套翻譯產生。

- 空值只由 `required` 處理。其他規則遇到空值（`null`、`''`、空陣列）直接通過。
- `minLength`、`maxLength`：以 Unicode code point 計算長度（`[...value].length`），`value` 為 ≥ 0 的整數。
- `min`、`max`：用在數值上；`decimal`、`currency` 的字串先轉成數值再比較。
- `maxFiles`：用在多檔上傳，比較陣列長度，`value` 為 ≥ 0 的整數。
- `pattern`：以 `new RegExp(pattern, 'u')` 比對整個值。伺服器產生時已包含 `^…$`，前端不另外加。
- `integer`、`numeric`：格式檢查。
- `email`、`url`：前端只做寬鬆的格式檢查，僅供即時提示；結果可能與伺服器不同，以伺服器的 422 為準。

## Action 的輸入欄位

`ActionDef.form` 讓 Action 在執行前開一個彈窗收集輸入：

```json
{
  "key": "reassign",
  "label": "轉派",
  "form": {
    "title": "轉派訂單",
    "submitLabel": "轉派",
    "fields": [{ "type": "textarea", "name": "reason", "label": "原因" }]
  }
}
```

收集到的值放在 `ActionRequest.input`，與 `target`、`ids` 一起送到 `endpoints.action`。值的格式與路徑規則同表單。422 的鍵是 `input` 內的值路徑，不加 `input.` 前綴（上例為 `reason`）。欄位限靜態扁平 `PlainFieldDef`，不接受 remote、relation、repeater、custom 或 upload。

## 快速新增

`ListPage.quickCreate` 在列表上提供一列精簡的新增：

```json
{
  "label": "快速新增",
  "submitUrl": "/admin/orders",
  "fields": [{ "type": "text", "name": "customer", "label": "客戶" }]
}
```

送出方式與表單相同：`POST submitUrl`，請求是 `FormSubmitRequest`，成功回 `FormSubmitResponse`，422 的鍵規則與值的處理也相同。欄位限靜態扁平 `PlainFieldDef`，不接受 remote、relation、repeater、custom 或 upload。

- 請求不帶 `after`，只有 `{ values }`。
- 正常儲存回應仍然要帶 `id` 和 `urls.edit`（schema 要求）。前端不依 `urls` 導向。取消分支見下節，不清空欄位或執行成功後的列表重整。
- 成功後前端清空快速新增的欄位並重新整理列表。`feedback` 照一般規則處理：有 `toast` 就顯示，有 `redirect` 就導向。

### Hook 取消送出

submitted/saving hook 可以中止儲存，回 HTTP 200：
`{ "cancelled": true, "feedback": { "toast": { "type": "info", "message": "Not saved" } } }`。
這個分支不需要資料 id 或成功後的 URLs。前端套用 feedback，保留欄位值與未儲存狀態，
不執行 `onSaved` 或使用者選的儲存後去向。明確提供且安全的 `feedback.redirect` 仍會導向。
正常儲存回應另有 `FormSubmitSuccess` 型別；成功回呼使用這個型別，而非整個回應聯集。

## 0.4.0 遞迴表單協定

本節定義 wire contract；條件運算、遠端載入、關聯／repeater 操作及 custom 註冊由後續 runtime 工作實作。
`schemaVersion` 為 `0.4.0`，套件版本另依 release 流程更新。

`FieldDef` 新增下列欄位。所有欄位沿用 `FieldBase`（`name`、`label`、`rules` 等）：

| type       | 宣告                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `relation` | `multiple:boolean`、`remote:RemoteOptions`、`fields?:FormNode[]`、`excludeSelectedIn?:ExclusionPath[]`                    |
| `repeater` | `mode` 為 `json`／`relation`、`nodes:FormNode[]`、`min?:number`、`max?:number`、`distinct?:string[]`、`sortable?:boolean` |
| `custom`   | `component:ComponentRef`、`displayOnly?:boolean`                                                                          |

`nodes` 與 `fields` 均引用同一個 `#/$defs/FormNode`；任意宣告深度都使用同一種結構。
relation 的 fields 放在選取物件的同一層，沒有額外 `extra` envelope。
單選值是 `null` 或 `{id:string,...declaredSelectionFields}`；多選值是有順序的此類物件陣列（`RelationValue`）。
`id` 是選取來源的身分，不是中介 child 的身分，標籤由搜尋／hydration 回覆提供。
關聯／資料表／association 名稱保留在伺服器宣告，不放進 schema。
伺服器透過權威 parent relation 及 selectable query 驗證既有 ID，重複／外來 ID 必須在修改之前拒絕。
不同 relation mode 的儲存策略由伺服器宣告決定，不能把所有關聯一律刪除重建。

custom 的完整形狀例如：

```json
{
  "type": "custom",
  "name": "total",
  "label": "Total",
  "component": { "type": "component", "name": "Calculator", "props": { "rate": 2 } },
  "displayOnly": true
}
```

可寫 custom 使用既有 renderer `FieldProps` 的 `def/value/onChange/onBlur/errors/path/form` 契約；
`errors` 相對於欄位，`path` 是完整數字路徑。後續 runtime 會加上 row context，不能建立另一套 value 介面。
`displayOnly:true` 可以有元件內部互動狀態，但不能呼叫 FormApi.setValue，也不寫入 model。
Grid custom inline editor 是 `{type:'custom',component:ComponentRef,rules?:ClientRule[]}`，使用一般 cell 更新端點與宣告規則。
custom display 沿用 `DisplaySchema` 既有的 ComponentRef alternative，沒有新的 custom display envelope。
既有 ComponentSlot registrations 仍接收 declaration props 與 `context:{row,column}`；後續 display registry 不得改壞此契約。

### 條件與路徑

FieldBase 的 `showWhen?:Condition` 與 `enableWhen?:Condition` 是 JSON AST，不能放 JavaScript／PHP expression：

```json
{
  "op": "all",
  "conditions": [
    { "op": "eq", "field": { "scope": "root", "path": "active" }, "value": true },
    { "op": "not", "condition": { "op": "empty", "field": { "scope": "row", "path": "code" } } }
  ]
}
```

- `ConditionPath` 為 `{scope:'root'|'row',path:string}`。scalar 路徑由安全的 named／numeric 點分段構成；不允許空段、parent traversal、prototype 名稱及 `*`。
- `eq`／`ne` 使用 `value:JsonPrimitive`；`in` 使用 `values:JsonPrimitive[]`；`empty` 只有 `field`。
- `all`／`any` 使用 `conditions:Condition[]`；`not` 使用 `condition:Condition`。`all([])=true`，`any([])=false`。
- equality 是嚴格型別比較；`empty` 是 null／undefined／空字串／空陣列，false 與 0 不是空值。依欄位型別 canonicalize，不能把產品代碼 `"001"` 一律轉成數字。
- row 路徑相對於所在 repeater row 或選取物件，不能從 numeric segments 猜 origin。未知宣告路徑或 activity dependency cycle 必須在宣告階段拒絕。
- 隱藏或條件停用欄位保留 browser draft，但不參與 client 驗證或 server writes；原有儲存值不變。伺服器使用送出的 controlling values 及權威 readonly values 重新判斷，visibility 不提供授權。
- 無效的 controlling value 要先得到自己的驗證錯誤，不能靠它隱藏 dependent requirement。inactive server errors 留在內部；重新啟用且值未變時恢復。未對應宣告的 server errors 仍是 blocking summary entries。

`excludeSelectedIn?:ExclusionPath[]`（form-only remote choices／relation）使用相同 explicit scope，另外允許 wildcard：
`{scope:'root',path:'choices.*.product'}` 展開所有現有 row，忽略目前欄位自己的 resolved path。
scalar／array choice values 都以字串 identity 排除；重複或自己排除不能抹掉目前選值。
exclusion dependencies 不是 activity dependencies；對稱排除宣告不構成 activity cycle。

### 遠端選項

靜態 `select`／`multipleSelect` 仍要求 `options`。form-only 遠端變體使用 `remote:RemoteOptions` 取代 options：
`{url:string,dependsOn?:Record<string,ConditionPath>}`，沿用一般選項的 presentation flags。
GET 透過 adapter 使用宣告的 url；dependency 值放在獨立 JSON `depends` 參數，不能混入 `q`、`page`、`per_page`、`value[]`、`section`。
伺服器只接受宣告過的 dependency 名稱，重算 authoritative readonly dependencies，root record 由 scoped route binding 決定。
回覆沿用 `OptionsResponse`／`PickerSearchResponse` 的 labels、group/depth、columns、sections 與 pagination。
hydration 也要使用相同來源範圍；不可用全域查詢找回外來 label。未回傳的 ID 維持 unresolved 並提供可存取的 unavailable indication，不能當成合法新選項寫入。
遠端回覆須依 endpoint、dependencies、stable row identity 與 request generation fencing；remove/reset 後晚到的回覆不能還原 row。

Grid FilterInput 的 `{type:'selectTable'}`／`{type:'multipleSelectTable'}` 使用既有 Grid options endpoint，source 是 filter declaration key。
它們沿用 PickerSearchResponse，沒有第二個 URL 或 client model identifier；URL filter value 仍為字串或字串陣列，不是 RelationValue。

`PlainFieldDef` 明列靜態扁平 variants，只供 Action、quick-create 與 upload.extra。
這些位置不接受 remote、relation、repeater、custom 或 upload，不能因 FieldDef 擴充而自動放寬。

### Row identity 與 upload context

每個 repeater row 用一個保留物件 `_brume:{key:string,id?:string}`（`RowIdentity`）。
既有 relation row 的 key 由 scoped record 決定；新 row 使用 client UUID，沒有 id。
JSON mode 不接受 relation id；既有純 JSON rows 在 readback 時，以權威 root／field／index context 產生 deterministic synthetic key，
第一次儲存後保留 metadata，後續讀取不可每次產生不同隨機 key。
重複 key／id 由 graph validation 拒絕。`_brume` 禁止作為 declared field name；metadata 不可 mass assign。
key 是已授權 root／field 之內的 identity hint，不是 filesystem path 或 authorization token。

multipart 新增 `rowContext`（`UPLOAD_PARAMS.rowContext`），值是 JSON-encoded `RowContext`，由外往內依序列出 `{path,key,id?}`：

```json
[
  { "path": "groups", "key": "group-17", "id": "17" },
  { "path": "groups.*.items", "key": "new-item-uuid" }
]
```

`path` 是依宣告決定的 canonical repeater template path；`*` 表示 row position，與 scalar condition／dependency 路徑不同。
沒有 row 時使用空陣列。原有 `field` 仍是數字值路徑，例如 `groups.0.items.2.files`，供錯誤定位，不能拿 index 當 upload ownership。
伺服器逐層透過 parent 驗證 relation id，從宣告推導 canonical field binding；token 綁 user、form、root record、canonical field 與 verified row-key chain。
排序或移除時 upload ownership 隨 stable identity；舊 generation 的回覆不得寫到新的 numeric index。
最終歸檔 context 從已驗證的 submitted graph 推導，不能信任旁送的 arbitrary context。
selected-item extras 的 row context 以 declaration 內 selected id 推導 stable key，不能混淆為 intermediary child id；remove/reselect 必須換 request generation。

數字 `field` 與 stable context 的合法性、mode-specific identity、重複身分、source scope、dependency cycles 與 graph persistence
需要 runtime／server 檢查；JSON Schema 只描述 wire 結構，不能提供這些授權保證。
