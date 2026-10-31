# Brume 請求與回應協定

端點網址一律來自 schema：列表的 `page.endpoints`（含 `{action}`、`{id}`、`{source}` 佔位字，值需 `encodeURIComponent`），表單的 `page.submit.url`、`page.uploadUrl`，以及 `ListPage.resource.*`、`ListPage.quickCreate.submitUrl`。型別定義在 `schema/v0.json` 的 `$defs`。表單的細節見 [forms.md](./forms.md)。

## 端點

| 用途                                                    | Method                                       | 請求                                           | 成功回應                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Action (`endpoints.action`)                             | POST                                         | `ActionRequest`                                | 200 `ActionResponse`                                                                                                            |
| 行內編輯 (`endpoints.cell`)                             | PATCH                                        | `CellUpdateRequest`                            | 200 `CellUpdateResponse`                                                                                                        |
| 遠端選項 (`endpoints.options`)                          | GET                                          | `?q=&page=&per_page=&value[]=`                 | 200 `OptionsResponse`                                                                                                           |
| 挑選器搜尋 (`endpoints.options`)                        | GET                                          | 同上，多一個 `section=`                        | 200 `PickerSearchResponse`                                                                                                      |
| 上傳暫存 (`endpoints.upload`、`page.uploadUrl`)         | POST multipart                               | `UPLOAD_PARAMS`：`file`、`field`、`rowContext` | 200 `UploadTempResponse`                                                                                                        |
| 表單送出 (`page.submit.url`)                            | POST（新增）／PUT（更新）                    | `FormSubmitRequest`                            | 200 `FormSubmitResponse`                                                                                                        |
| 快速新增 (`quickCreate.submitUrl`)                      | POST                                         | `FormSubmitRequest`                            | 200 `FormSubmitResponse`                                                                                                        |
| 彈窗載入表單 (`resource.createUrl`、`resource.editUrl`) | GET，標頭 `FORM_HEADER`（`X-Brume-Form: 1`） | —                                              | 200 JSON `PageEnvelope`（`page.type === 'form'`）；401／403／404 `ErrorResponse`。帶與不帶標頭的回應都要有 `Vary: X-Brume-Form` |

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

`value[]` 用來把已選取的值換回標籤：帶入已選值，伺服器在同一個 declared selectable scope 內回傳對應的 `OptionItem`，不受 `q` 與分頁限制；不能用全域 fallback 揭露外來 ID 的標籤。`pagination.hasMore` 決定是否還能載入下一頁。form-only `RemoteOptions.dependsOn` 的解析值放在獨立 JSON `depends` 參數（`OPTIONS_PARAMS.depends`），不混入搜尋或 ID 欄位。

## 上傳生命週期

見 [forms.md 的上傳生命週期](./forms.md#上傳生命週期)。`UploadTempResponse.expiresAt` 為 ISO 8601 的 UTC 時間，例如 `2026-10-29T03:00:00Z`。

## 挑選器

`PickerSearchResponse` 的 `columns` 與 `sections` 供挑選器顯示欄位與分區。挑選器搜尋打的是同一個 `endpoints.options`（`{source}` 為挑選器的來源鍵），多帶 `section=<key>` 選分區，`key` 取自 `sections[].key`；省略時為第一個分區。參數名稱定義在 `OPTIONS_PARAMS`。挑選器 UI 在子計畫 3 實作。

Form options and picker requests also accept `rowContext` (`OPTIONS_PARAMS.rowContext`): a JSON
outer-to-inner `RowContext` chain, separate from `depends`. Omission and `[]` both mean root.
Each entry carries a canonical declaration path and stable key, plus the related child ID for
relation repeater rows, no ID for JSON rows, or selected source ID for picker selections. Picker
keys are exactly that selected source string ID. An intermediary child ID must be resolved through
the authoritative parent association, never substituted for a selected source ID. The server must
validate this chain before reevaluating readonly dependencies and applying the declared query scope.
Array hydration uses adapter query `{value: ids}` so transport emits `value[]=...` once.

Nested dependency targets also send optional JSON `dependencyContexts`: a map from declared
`dependsOn` name to the target field's current `RowContext`. Root scalar targets omit it. A root
numeric path such as `rows.0.region` addresses the current draft position, so after reorder its
readonly value must be resolved using this target chain, not the owner's chain or stored index.
The server rejects missing ambiguous chains, malformed chains, and undeclared dependency names.
Only unambiguous row-relative current-row/ancestor targets may derive their chain from the owner.

Requests that traverse picker selections send optional JSON `ancestorSources`, an array of
`OptionAncestorSourceContext` entries:

```ts
{
  path: 'groups.*.products',       // canonical picker declaration
  rowContext: [{path: 'groups', key: 'group-a', id: '12'}], // before the selection
  depends: { category: 'books' },
  dependencyContexts: { category: [{path: 'groups', key: 'group-a', id: '12'}] }
}
```

An instance is identified by `path` plus its exact ordered owner chain. Two outer rows using the
same picker declaration need separate entries; multiple selected IDs of the same instance reuse
one. Collect instances reachable from the owner, dependency targets, and declared descendants of
whole collection dependencies, recursively including source dependencies. Servers reject duplicate,
unreachable, unknown or cyclic entries. Before calling a child source, a new selected source ID
must belong to the ancestor's scoped source query. Existing intermediary identity resolves only
through the actual parent association; a new row's callback model is null.

`depends` and each ancestor's `depends` are JSON **objects**. Their declared custom child values
retain object versus list semantics, including `{}` versus `[]`; there are no client type hints.
Whole collection dependencies project declared children and identity only and restore readonly or
statically disabled descendants from verified storage. This endpoint does not write a relation graph.

All dependency values, target chains, ancestor instances and private row lifetimes participate in
both search and hydration ownership, including synchronous checks before React commits. Removing
and re-adding an identical row invalidates its old replies. Private lifetime counters never travel
over the wire. Cyclic source contexts disable the client source without throwing during rendering.

New scoped-source endpoints default to page 1 and 20 rows, accept at most 50 rows per page and
100 distinct hydration IDs, and reject malformed paging/IDs or unknown sections with 422. Page is
bounded to 999999, search text to 1000 bytes, each context JSON parameter to 65536 bytes/64 JSON
levels, and ancestor metadata to 100 instances. Hydration preserves request order, omits unavailable
IDs, and cannot disclose foreign labels. The legacy Grid remote-combobox API retains its documented
tolerant paging and truncation behavior.

The renderer's local relation drafts compose private row ownership with the actual parent Form for
outside dependency targets. The React `RelationPicker.renderSelection` callback has an optional sixth
argument, `getDraftIdentity(id): number | undefined`; the primitive always supplies it. Custom
selection renderers that construct draft Form APIs must forward this accessor along with `getDraft`.
It identifies an item's private lifetime within that picker instance, changes on removal/reselection
or replacement, and stays stable for ordinary value edits or movement. It is bound to the calling
selection and open session; obsolete, closed, or unmounted accessors return undefined. These opaque
numbers are not source IDs, row order, persistence metadata or wire parameters.

Draft ownership combines the parent's applicable lifetime, that selection lifetime, and the
descendant lifetime shared by the drafts of the same live picker view. Outside parent targets delegate to the live parent owner, so intermediate
remove/readd operations cannot be erased by React batching. A surviving selection also observes the
new private identity when a sibling selection is removed and re-added with the same ID and payload.

The internal descendant tracker is initialized from the complete live selection before peer effects
run. Descendant removal/readdition updates it synchronously at every configured depth, including
whole-collection dependency projections. Resetting or unmounting one selection preserves its peers'
lifetimes. Nested pickers compose this tracker with their actual parent's ownership; sessions remain
isolated. This adds no public callback argument or request metadata.
