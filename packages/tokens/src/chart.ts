import type { ModeValue } from './semantic';

/**
 * Data-visualisation colours (`--br-chart-*`). Categorical slots are assigned in this fixed order
 * and never cycled; the order is what keeps neighbouring series apart for colour-blind readers.
 *
 * Every slot is a step from the dataviz reference ramps (blue, orange, aqua, yellow, magenta,
 * green, violet, red). Light mode takes the darker step for aqua, yellow and magenta so every
 * mark clears 3:1 on `surface`. chart-palette.test.ts re-runs the checks: lightness band, chroma
 * floor, adjacent CVD separation (protan/deutan, OKLab ΔE ≥ 8), normal-vision ΔE ≥ 15 and 3:1
 * contrast, against both surfaces.
 */
export const chartSeries = {
  'chart-1': { light: '#2a78d6', dark: '#3987e5' },
  'chart-2': { light: '#eb6834', dark: '#d95926' },
  'chart-3': { light: '#199e70', dark: '#199e70' },
  'chart-4': { light: '#c98500', dark: '#c98500' },
  'chart-5': { light: '#d55181', dark: '#d55181' },
  'chart-6': { light: '#008300', dark: '#008300' },
  'chart-7': { light: '#6250d6', dark: '#9085e9' },
  'chart-8': { light: '#e34948', dark: '#e66767' },
} as const satisfies Record<string, ModeValue>;

/** Chart furniture and the meaning-carrying colours (never used as "series n"). */
export const chartRoles = {
  /** A value that went the good way (delta marks, up bars). Always paired with an icon or sign. */
  'chart-positive': { light: '#0ca30c', dark: '#0ca30c' },
  /** A value that went the bad way. Always paired with an icon or sign. */
  'chart-negative': { light: '#d03b3b', dark: '#d03b3b' },
  /** De-emphasis and the folded "Other" slice. */
  'chart-muted': { light: '#8592a0', dark: '#6f7d8c' },
  /** Hairline gridlines, one step off the surface. */
  'chart-grid': { light: '#e3e8ee', dark: '#263140' },
  /** Baseline / axis rule, a step stronger than the grid. */
  'chart-axis': { light: '#c5cdd6', dark: '#3a4758' },
} as const satisfies Record<string, ModeValue>;

export const chart = { ...chartSeries, ...chartRoles } as const;

export type ChartToken = keyof typeof chart;

/** Number of categorical slots. A series past this folds into "Other" instead of a new hue. */
export const CHART_SERIES_COUNT = Object.keys(chartSeries).length;
