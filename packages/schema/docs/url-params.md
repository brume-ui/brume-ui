# 網址參數約定

本文件是與後端無關的規格（設計文件 §13.4），任何後端只要照此解析網址參數，前端就不用改。

## 第 1 階段

### `page`

- 列表頁的頁碼，從 1 起算的正整數。例：`/users?page=2`。
- 缺省時視為 `1`。
- 越界或非法的值不得造成錯誤（不能回 500），由後端修正為最近的合法值：
  - 大於最後一頁（例如 `?page=999`）：落到最後一頁。
  - 小於 1、為 0 或負數（例如 `?page=-1`）：落到第 1 頁。
  - 非數字（例如 `?page=abc`）：落到第 1 頁。
  - 沒有任何資料時，最後一頁視為第 1 頁。
- 沒有任何資料（零筆）時，`pagination.lastPage` 仍為 `1`（`lastPage` 最小值是 1），`total` 為 `0`。
- 回應的 `pagination.page` 永遠是修正後的實際頁碼，前端以它為準。

## 第 2 階段

前端以 `parseGridQuery` / `serializeGridQuery` / `withGridQuery`（`@brume-ui/brume-schema`）讀寫下列參數。

### 排序

- `sort=amount` 升冪，`sort=-amount` 降冪。一次只排一個欄位。

### 每頁筆數、搜尋、範圍

- `per_page=50`：每頁筆數。
- `q=關鍵字`：快速搜尋。
- `scope=vip`：預設範圍（具名子集）。

### 篩選

| 形狀       | 範例                                                                  |
| ---------- | --------------------------------------------------------------------- |
| 單值       | `filter[status]=paid`                                                 |
| 多值       | `filter[status][]=paid&filter[status][]=shipped`                      |
| 區間       | `filter[amount][start]=100&filter[amount][end]=500`（兩端可只給一端） |
| 運算子群組 | `filter[amount][op]=gt&filter[amount][value]=100`                     |

### 通用規則

- 空字串、空陣列、兩端都空的區間一律視為「沒有這個篩選」，序列化時省略。
- 其他不認得的參數原樣保留。
- 變更 `page` 以外的任何參數時，`page` 回到 1（移除 `page` 參數）。
- 後端對非法值的處理：未知的 `sort` 鍵、不在選項內的 `per_page`、形狀不對的 `filter[*]`、未知的 `scope`，一律忽略，不回錯。後端在 `page.query` 回傳修正後實際套用的狀態，前端以它為準。
