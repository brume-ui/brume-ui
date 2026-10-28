# Brume 請求與回應協定

端點網址一律來自 `page.endpoints`（含 `{action}`、`{id}`、`{source}` 佔位字，值需 `encodeURIComponent`）。型別定義在 `schema/v0.json` 的 `$defs`。

## 端點

| 用途                             | Method         | 請求                           | 成功回應                   |
| -------------------------------- | -------------- | ------------------------------ | -------------------------- |
| Action (`endpoints.action`)      | POST           | `ActionRequest`                | 200 `ActionResponse`       |
| 行內編輯 (`endpoints.cell`)      | PATCH          | `CellUpdateRequest`            | 200 `CellUpdateResponse`   |
| 遠端選項 (`endpoints.options`)   | GET            | `?q=&page=&per_page=&value[]=` | 200 `OptionsResponse`      |
| 挑選器搜尋 (`endpoints.options`) | GET            | 同上，多一個 `section=`        | 200 `PickerSearchResponse` |
| 上傳暫存 (`endpoints.upload`)    | POST multipart | `file`、`field`                | 200 `UploadTempResponse`   |

## 狀態碼

- 200：成功。
- 401：未登入。
- 403：不允許。
- 404：id 不在範圍內。
- 419：CSRF 逾時。
- 422：驗證錯誤。`ErrorResponse.errors` 的鍵為欄位名；行內編輯時為 column key。
- 其他 4xx / 5xx：`ErrorResponse`，與 Laravel 預設 JSON 錯誤相容。

## 回饋（Feedback）

前端處理順序：先 toast，再 download；`redirect` 優先於 `refresh`（兩者同時存在時只執行 redirect）。

## 遠端選項

`value[]` 用來把已選取的值換回標籤：帶入已選值，伺服器回傳對應的 `OptionItem`，不受 `q` 與分頁限制。`pagination.hasMore` 決定是否還能載入下一頁。

## 上傳生命週期

`POST endpoints.upload`（multipart，欄位 `file` 與 `field`）暫存（`UploadTempResponse.token`）→ 表單儲存時以 token 歸檔（`UploadValue` 的 `{ token }` 變成 `{ path, url }`）→ 孤兒檔在 `expiresAt` 後清除。`UploadValue` 的兩種形狀互斥：不允許其他屬性，所以同時帶 `token` 與 `path` 的值不合法。上傳服務本身在子計畫 2 實作。

## 挑選器

`PickerSearchResponse` 的 `columns` 與 `sections` 供挑選器顯示欄位與分區。挑選器搜尋打的是同一個 `endpoints.options`（`{source}` 為挑選器的來源鍵），多帶 `section=<key>` 選分區，`key` 取自 `sections[].key`；省略時為第一個分區。參數名稱定義在 `OPTIONS_PARAMS`。挑選器 UI 在子計畫 3 實作。
