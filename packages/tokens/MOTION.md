# 柔霧動效（Motion）

原則：短、從快到慢、不搶戲。動效只用來交代「東西從哪來、狀態變了、操作有回應」，不做裝飾。

## Token

| 用途                                             | CSS 變數                | Brume 內部 Tailwind   | 值                                              |
| ------------------------------------------------ | ----------------------- | --------------------- | ----------------------------------------------- |
| 按下回饋、離場、小變化                           | `--br-duration-instant` | `br:duration-instant` | 100ms                                           |
| hover、顏色、下拉選單、焦點環                    | `--br-duration-fast`    | `br:duration-fast`    | 150ms（預設 transition 時間）                   |
| 彈窗進場、勾選、指示條移動、展開高度             | `--br-duration-base`    | `br:duration-base`    | 200ms                                           |
| 大面積移動：側欄寬度、抽屜、toast 堆疊、主題淡換 | `--br-duration-slow`    | `br:duration-slow`    | 280ms                                           |
| 只有透明度的淡入淡出                             | `--br-duration-fade`    | `br:duration-fade`    | 150ms                                           |
| 進場、離場、大部分 UI                            | `--br-ease-out`         | `br:ease-out`         | `cubic-bezier(0.23, 1, 0.32, 1)`（預設 easing） |
| 在畫面上移動或變形（指示條、寬高、堆疊）         | `--br-ease-emphasized`  | `br:ease-emphasized`  | `cubic-bezier(0.32, 0.72, 0, 1)`                |
| 小確認的回彈（勾選、按下放開）                   | `--br-ease-spring`      | `br:ease-spring`      | `cubic-bezier(0.34, 1.36, 0.64, 1)`             |

JS 端可從 `@brume-ui/brume-tokens` 匯入 `duration`、`easing`。

`br:ease-*`、`br:duration-*` 只存在於 Brume 自己的 build（`motion-theme.css`，會改掉 Tailwind 的預設 transition 曲線並拿掉 `ease-in`，**不要**匯入專案自己的 Tailwind）。共用的 `theme.css` 不碰任何動效預設。專案端直接用變數：`ease-(--br-ease-out)`、`duration-(--br-duration-fast)`，或在 CSS 寫 `transition: opacity var(--br-duration-fade) ease`。

## 規則

1. **不用 ease-in。** ease-in 起步慢，同樣時間看起來更拖。Brume 內部 build 已把 `br:ease-in` 拿掉；專案自己的 Tailwind 不受影響，請自行遵守。顏色變化可用 `ease`。
2. UI 動效都在 300ms 以內；離場比進場快（例：彈窗進 200ms、出 150ms）。
3. 只動 `transform`（含 `scale`、`translate`、`rotate`）和 `opacity`；寬高只用在側欄、展開群組這種一次性的變化。
4. 縮放進場從 0.96 開始，不從 0。彈出選單用 Radix 的 `--radix-*-content-transform-origin` 從觸發點長出來；彈窗維持中心。
5. 會被連續觸發的（hover、highlight、指示條）用 CSS transition，可以中途改方向；keyframes 只用在一次性的進出場（Radix `data-state`）。
6. 按下回饋：`scale(0.97)`（小方塊如 checkbox 用 0.9），放開用 spring 回彈。
7. 一天按上百次的動作（鍵盤快捷、選單裡上下移動）不加動畫或只用 instant。
8. 主色預算不變：動效不新增主色使用處。

## 減少動態效果（prefers-reduced-motion）

- tokens.css 在 `prefers-reduced-motion: reduce` 時把 instant / fast / base / slow 設為 `0ms`，`fade` 保留 100ms。
- brume-react 的 keyframes 在此模式下改成只有透明度（彈窗、選單、抽屜、錯誤訊息只淡入）；按下縮放、圖示旋轉關閉；列淡入與數字滾動的錯開延遲歸零；骨架不再閃光；主題切換不跑 View Transition。
- 主題淡換的 `::view-transition-*` 規則只在 Brume 切換主題時（`<html data-brume-theme-switch>`）生效，不影響專案自己的 View Transition。
- 只有 CSS 管不到的（JS 控制的序列、View Transition、數字滾動的首次動畫）才需要 `usePrefersReducedMotion()`（`@brume-ui/brume-react` 匯出）。

## 自訂元件怎麼動

- 直接用 token：`br:transition-[opacity,scale] br:duration-fast br:ease-out`，減少動態效果自動生效。
- **進場長出**（例：迷你長條圖）：每根從 `scaleY(0.6)`＋`opacity:0` 長到原狀，`transform-origin: bottom`，`--br-duration-slow`＋`--br-ease-out`，相鄰間隔 30–50ms，總長不超過 500ms，且不能擋住操作。
- **hover 數值**：hover 的那一根提高對比（其他降到 60% 透明度），數值提示用 `br-pop-in`（fast）出現；提示在相鄰項目間移動時用 transition 滑過去，不要每次重新淡入。
- **數字變化**：用 `<RollingNumber>`，不要自己逐格 setState。
- Radix 元件：在 `data-[state=open]` / `data-[state=closed]` 套 `br-pop-in` / `br-pop-out`（離場加 `forwards`），可參考 `@brume-ui/brume-react` 的 `motion/classes.ts`。
