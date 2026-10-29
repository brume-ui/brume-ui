# Brume 請求與回應協定

端點網址一律來自 schema：列表的 `page.endpoints`（含 `{action}`、`{id}`、`{source}` 佔位字，值需 `encodeURIComponent`），表單的 `page.submit.url`、`page.uploadUrl`，以及 `ListPage.resource.*`、`ListPage.quickCreate.submitUrl`。型別定義在 `schema/v0.json` 的 `$defs`。表單的細節見 [forms.md](./forms.md)。

## 端點

| 用途                                                    | Method                                       | 請求                             | 成功回應                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Action (`endpoints.action`)                             | POST                                         | `ActionRequest`                  | 200 `ActionResponse`                                                                                                            |
| 行內編輯 (`endpoints.cell`)                             | PATCH                                        | `CellUpdateRequest`              | 200 `CellUpdateResponse`                                                                                                        |
| 遠端選項 (`endpoints.options`)                          | GET                                          | `?q=&page=&per_page=&value[]=`   | 200 `OptionsResponse`                                                                                                           |
| 挑選器搜尋 (`endpoints.options`)                        | GET                                          | 同上，多一個 `section=`          | 200 `PickerSearchResponse`                                                                                                      |
| 上傳暫存 (`endpoints.upload`、`page.uploadUrl`)         | POST multipart                               | `UPLOAD_PARAMS`：`file`、`field` | 200 `UploadTempResponse`                                                                                                        |
| 表單送出 (`page.submit.url`)                            | POST（新增）／PUT（更新）                    | `FormSubmitRequest`              | 200 `FormSubmitResponse`                                                                                                        |
| 快速新增 (`quickCreate.submitUrl`)                      | POST                                         | `FormSubmitRequest`              | 200 `FormSubmitResponse`                                                                                                        |
| 彈窗載入表單 (`resource.createUrl`、`resource.editUrl`) | GET，標頭 `FORM_HEADER`（`X-Brume-Form: 1`） | —                                | 200 JSON `PageEnvelope`（`page.type === 'form'`）；401／403／404 `ErrorResponse`。帶與不帶標頭的回應都要有 `Vary: X-Brume-Form` |

## 請求

所有 API 請求（不含換頁）的共同約定：

- 標頭帶 `Accept: application/json`、`X-Requested-With: XMLHttpRequest`，同源送出 cookie（`credentials: 'same-origin'`）。
- 有 body 時為 JSON（`Content-Type: application/json`）；上傳為 multipart。
- **CSRF**：伺服器以 cookie `XSRF-TOKEN` 發放 token（值可經 URL 編碼，前端可讀）。前端讀出 cookie、解碼後放在 `X-XSRF-TOKEN` 標頭送出。所有寫入（POST / PUT / PATCH / DELETE）都要檢查，不符或逾時回 419。

## 狀態碼

- 200：成功。
- 401：未登入。
- 403：不允許。
- 404：id 不在範圍內。
- 419：CSRF 逾時。
- 422：驗證錯誤。`ErrorResponse.errors` 的鍵是值的點路徑（`meta.color`、`images.2.extra.link`），相對於送出值的根：表單為 `values`，Action 為 `input`，都不加前綴；行內編輯時為 column key。
- 其他 4xx / 5xx：`ErrorResponse`，與 Laravel 預設 JSON 錯誤相容。

## 回饋（Feedback）

前端處理順序：先 toast，再 download；`redirect` 優先於 `refresh`（兩者同時存在時只執行 redirect）。

## 遠端選項

`value[]` 用來把已選取的值換回標籤：帶入已選值，伺服器回傳對應的 `OptionItem`，不受 `q` 與分頁限制。`pagination.hasMore` 決定是否還能載入下一頁。

## 上傳生命週期

見 [forms.md 的上傳生命週期](./forms.md#上傳生命週期)。`UploadTempResponse.expiresAt` 為 ISO 8601 的 UTC 時間，例如 `2026-10-29T03:00:00Z`。

## 挑選器

`PickerSearchResponse` 的 `columns` 與 `sections` 供挑選器顯示欄位與分區。挑選器搜尋打的是同一個 `endpoints.options`（`{source}` 為挑選器的來源鍵），多帶 `section=<key>` 選分區，`key` 取自 `sections[].key`；省略時為第一個分區。參數名稱定義在 `OPTIONS_PARAMS`。挑選器 UI 在子計畫 3 實作。
