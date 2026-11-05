# brume-ui

Brume admin-panel UI kit (pnpm monorepo).

| Package                    | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `@brume-ui/brume-tokens`   | Design tokens (CSS variables `--br-*`)                           |
| `@brume-ui/brume-react`    | React components (charts: [CHARTS.md](packages/react/CHARTS.md)) |
| `@brume-ui/brume-schema`   | Page schema (TypeBox)                                            |
| `@brume-ui/brume-renderer` | Schema renderer                                                  |
| `@brume-ui/brume-inertia`  | Inertia adapter                                                  |

Without Laravel/Inertia, use `createFetchAdapter` + `BrumeRemotePage` with any backend: see
[standalone use](docs/standalone.md).

## Commands

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

Packages are published to npmjs.com under the `@brume-ui` scope (dist-tag `alpha` for prereleases),
by `.github/workflows/release.yml` on a `v*` tag push, using npm trusted publishing with provenance.


Custom frontends can pass the renderer's public `fields` and `displays` registrations directly to
`createBrumeApp`, alongside existing `components` and `pages`. A field opts into custom Grid inline
editing with `{ component: AddressField, inlineEditable: true }`; the default remains form-only.
See [Form contracts](packages/schema/docs/forms.md) and Playground `/#/form-composition` for nested
relations/JSON, dependent options, picker drafts and custom fields. Prepared alpha.14 artifacts
include these APIs and schema `0.4.0`; publication follows review and ordinary CI.

## 功能示範與試用範圍

Playground `/#/` 或 `/#/demos` 提供可搜尋功能目錄；`/#/public-contracts` 聚焦公開元件、renderer、adapter、query、schema 與設計 token。各情境都有操作、預期結果及來源。完整清單見 [demo coverage](docs/demo-coverage.md)。

- 記憶體示範只保留目前頁面資料；重新整理會重置。
- 外觀示範展示元件與樣式，沒有業務資料儲存。
- 後端契約列出實際 fixture、精確測試名稱與隔離執行命令，不把瀏覽器 memory 結果當作交易、權威值或附件清理證據。
- 資料庫贈品入口連到另外啟動的 Laravel Workbench；先依後端 README 備份並只套用新增欄位 migration，保留原資料與附件。

根層贈品：`/#/form-conditions`；門檻獨立贈品：`/#/form-composition`。優惠券與點數只有設定，沒有發放、兌換或帳本。S4 商品／分類／促銷產品驗收頁維持暫停；未來能力不計入已實作功能。

Coverage 的 READY 表示已有目標與來源證據，不代表遠端瀏覽器、MySQL 或 live 交付已通過。SQLite 與 MySQL 為目前驗收範圍；PostgreSQL 尚未驗證。遠端 CI、截圖審閱與原始試用 checkout 更新由 controller 執行。
