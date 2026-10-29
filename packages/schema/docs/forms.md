# Brume 表單協定

表單頁是 `page.type === 'form'` 的 `PageEnvelope`（`FormPage`）。本文件說明前端與伺服器之間的約定，與後端實作無關。型別定義在 `schema/v0.json` 的 `$defs`；其他端點與狀態碼見 [protocol.md](./protocol.md)。

端點網址一律來自 schema：`page.submit.url`、`page.uploadUrl`、`ListPage.resource.*`、`ListPage.quickCreate.submitUrl`。前端不自行拼路徑，`{id}` 佔位字的值用 `encodeURIComponent` 編碼。

## 兩種呈現，同一份定義

表單可以是整頁（`presentation: 'page'`），也可以是列表上的彈窗（`'modal'`）。兩者取得的是同一份 `FormPage`：

- 整頁：一般的頁面導覽，打開新增或編輯頁的網址。
- 彈窗：`GET <新增或編輯頁的網址>`，帶標頭 `X-Brume-Form: 1`（常數 `FORM_HEADER`，值固定為 `'1'`）。回應是 `PageEnvelope`，`page.type === 'form'`。

網址來自 `ListPage.resource.createUrl` 與 `ListPage.resource.editUrl`（含 `{id}`），`resource.presentation` 決定列表上用哪一種。同一個網址會依標頭回傳不同的內容，所以伺服器必須帶 `Vary: X-Brume-Form`，避免快取混用。

## 值與路徑

表單的值（`FormPage.values`、`FormSubmitRequest.values`）是一個巢狀物件：

- 欄位的 `name` 是相對於所在容器的鍵。`embeds` 節點會加一層前綴，它底下的值是 `name` 底下的物件。
- 路徑用點分隔，陣列索引是數字段，與 Laravel 的驗證鍵相同：`meta.color`、`images.2.extra.link`、`conditions.1.actions.0.freebies.3.given_limit`。

線上的值格式：

| 欄位                                 | 值                                                            |
| ------------------------------------ | ------------------------------------------------------------- |
| `date`                               | `YYYY-MM-DD`                                                  |
| `datetime`                           | `YYYY-MM-DDTHH:mm`（與原生 `datetime-local` 相同）            |
| `dateRange`、`datetimeRange`         | `{ start?, end? }`，各自用上面的格式                          |
| `number`                             | JSON number 或 `null`                                         |
| `decimal`、`currency`                | 固定小數位數的字串（例如 `"1280.50"`）或 `null`，避免浮點誤差 |
| `switch`                             | boolean                                                       |
| `select`、`radio`                    | string 或 `null`                                              |
| `multipleSelect`、`checkbox`、`tags` | `string[]`                                                    |
| `upload`（單檔）                     | `UploadValue \| null`                                         |
| `upload`（多檔）                     | `UploadValue[]`，陣列順序就是排序                             |
| `embeds`                             | 物件                                                          |
| `password`                           | 載入時一律是 `''`                                             |

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

前端依使用者選的 `after` 和 `urls` 決定下一步：`list` 回到列表、`edit` 繼續編輯這筆、`create` 繼續新增、`view` 查看。`urls.edit` 一定存在，其他看伺服器提供哪些。`feedback.redirect` 存在時以它為準，不看 `after`。`feedback` 的其他欄位照 [protocol.md 的回饋](./protocol.md#回饋feedback) 處理。

## 上傳生命週期

1. 使用者選了檔案，前端立即 `POST page.uploadUrl`，multipart 帶 `file`（檔案）和 `field`（欄位的完整值路徑，例如 `images` 或 `gallery.cover`）。參數名稱定義在 `UPLOAD_PARAMS`。伺服器回 `UploadTempResponse`。
2. 送出表單時：
   - 新檔案以 `{ token, extra }` 送出。
   - 舊檔案以載入時拿到的 `{ path, url, extra }` 原樣送回。
3. 伺服器把 token 對應的暫存檔歸檔，並刪除這筆資料這個欄位原本有、但這次沒有送回的舊檔。
4. token 只對同一個使用者、同一個表單、同一個欄位有效。過了 `expiresAt` 還沒被歸檔的暫存檔會被清除。

多檔上傳的陣列順序就是排序。`UploadValue` 的兩種形狀互斥：不允許其他屬性，所以同時帶 `token` 與 `path` 的值不合法。

## 前端驗證（`ClientRule`）

伺服器是唯一的權威。前端只先檢查 `FieldDef.rules` 裡的子集，`message` 由伺服器以與 422 同一套翻譯產生。

- 空值只由 `required` 處理。其他規則遇到空值（`null`、`''`、空陣列）直接通過。
- `minLength`、`maxLength`：以 Unicode code point 計算長度（`[...value].length`），`value` 為 ≥ 0 的整數。
- `min`、`max`：用在數值上；`decimal`、`currency` 的字串先轉成數值再比較。
- `maxFiles`：用在多檔上傳，比較陣列長度，`value` 為 ≥ 0 的整數。
- `pattern`：以 `new RegExp(pattern, 'u')` 比對整個值。伺服器產生時已包含 `^…$`，前端不另外加。
- `email`、`url`、`integer`、`numeric`：格式檢查。

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

收集到的值放在 `ActionRequest.input`，與 `target`、`ids` 一起送到 `endpoints.action`。值的格式與路徑規則同表單。422 的鍵是 `input` 內的值路徑，不加 `input.` 前綴（上例為 `reason`）。欄位不可含 `upload`。

## 快速新增

`ListPage.quickCreate` 在列表上提供一列精簡的新增：

```json
{
  "label": "快速新增",
  "submitUrl": "/admin/orders",
  "fields": [{ "type": "text", "name": "customer", "label": "客戶" }]
}
```

送出方式與表單相同：`POST submitUrl`，請求是 `FormSubmitRequest`，成功回 `FormSubmitResponse`，422 的鍵規則也相同。欄位不可含 `upload`。
