import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { mockReducedMotion } from '../motion/test-utils';
import { BrumeProvider } from '../provider';
import { BarChart } from './bar-chart';
import { monotonePath, segments } from './curve';
import { DonutChart } from './donut-chart';
import { LineChart } from './line-chart';
import { stubLayoutWidth } from './test-width';
import { pruneHidden, toggleHidden } from './use-chart';

beforeEach(() => {
  stubLayoutWidth();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderChart(ui: ReactElement, locale: 'zh-TW' | 'en' = 'zh-TW') {
  return render(
    <BrumeProvider adapter={createMemoryAdapter()} locale={locale}>
      {ui}
    </BrumeProvider>,
  );
}

const SALES = [
  { category: '服飾', online: 1200, store: 800 },
  { category: '家居', online: 900, store: 1500 },
  { category: '3C', online: 2400, store: 600 },
];
const SERIES = [
  { key: 'online', label: '線上' },
  { key: 'store', label: '門市' },
];

const describedBy = (el: HTMLElement) =>
  document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;

const tooltip = (container: HTMLElement) => container.querySelector('[data-chart-tooltip]');

describe('toggleHidden', () => {
  it('hides and shows a series', () => {
    const hidden = toggleHidden(new Set(), 'a', ['a', 'b']);
    expect([...hidden]).toEqual(['a']);
    expect([...toggleHidden(hidden, 'a', ['a', 'b'])]).toEqual([]);
  });

  it('never hides the last visible series', () => {
    expect([...toggleHidden(new Set(['a']), 'b', ['a', 'b'])]).toEqual(['a']);
  });
});

describe('BarChart', () => {
  it('is a figure named by its title with a summary and a data table twin', () => {
    renderChart(
      <BarChart
        title="各分類營收"
        data={SALES}
        categoryKey="category"
        series={SERIES}
        valueFormat={{ style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }}
      />,
      'en',
    );
    const figure = screen.getByRole('figure', { name: '各分類營收' });
    expect(describedBy(figure)).toBe(
      '6 data points, lowest NT$600 (3C 門市), highest NT$2,400 (3C 線上).',
    );
    const table = within(figure).getByRole('table', { name: 'Data for 各分類營收' });
    const rows = within(table).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Item線上門市',
      '服飾NT$1,200NT$800',
      '家居NT$900NT$1,500',
      '3CNT$2,400NT$600',
    ]);
  });

  it('draws one bar per series per category and nice value ticks', () => {
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
      'en',
    );
    expect(container.querySelectorAll('[data-bar-group] path')).toHaveLength(6);
    const ticks = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(ticks).toEqual(expect.arrayContaining(['0', '1K', '2K', '3K']));
  });

  it('stacks series: the axis covers the stack totals', () => {
    const { container } = renderChart(
      <BarChart
        title="營收"
        data={SALES}
        categoryKey="category"
        series={SERIES}
        layout="stacked"
      />,
      'en',
    );
    const ticks = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(ticks).toContain('3K');
    expect(container.querySelectorAll('[data-bar-group="0"] path')).toHaveLength(2);
  });

  it('legend toggles a series but always keeps one visible', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    const online = screen.getByRole('button', { name: '線上' });
    const store = screen.getByRole('button', { name: '門市' });
    expect(online.getAttribute('aria-pressed')).toBe('true');

    await user.click(online);
    expect(online.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-series="online"]')).toHaveLength(0);
    expect(store.getAttribute('aria-disabled')).toBe('true');

    await user.click(store);
    expect(store.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-series="store"]')).toHaveLength(3);

    await user.click(online);
    expect(container.querySelectorAll('[data-series="online"]')).toHaveLength(3);
    expect(store.hasAttribute('aria-disabled')).toBe(false);
  });

  it('has no legend for a single series (the title names it)', () => {
    renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={[SERIES[0] as never]} />,
    );
    expect(screen.queryByRole('list', { name: /圖例/ })).toBeNull();
  });

  it('keyboard: focus shows the first category, arrows step, Escape hides', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    const plot = screen.getByRole('group', { name: /營收：用方向鍵/ });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(plot);
    expect(tooltip(container)?.textContent).toBe('服飾1,200線上800門市');
    expect(container.querySelector('[aria-live]')?.textContent).toBe('服飾：線上 1,200，門市 800');

    await user.keyboard('{ArrowRight}');
    expect(tooltip(container)?.textContent).toContain('家居');
    await user.keyboard('{End}');
    expect(tooltip(container)?.textContent).toContain('3C');
    await user.keyboard('{ArrowRight}');
    expect(tooltip(container)?.textContent).toContain('3C');
    await user.keyboard('{Escape}');
    expect(tooltip(container)).toBeNull();
  });

  it('pointer: hovering a category highlights it and dims the others', () => {
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    const plot = container.querySelector('[data-chart="bar"]') as HTMLElement;
    // Fallback width 640, so the last third of the plot is the third category.
    fireEvent.pointerMove(plot, { clientX: 600, clientY: 100 });
    expect(tooltip(container)?.textContent).toContain('3C');
    const groups = [...container.querySelectorAll<SVGGElement>('[data-bar-group]')];
    expect(groups.map((g) => g.style.opacity)).toEqual(['0.6', '0.6', '1']);
    fireEvent.pointerLeave(plot);
    expect(tooltip(container)).toBeNull();
  });

  it('shows loading and empty states in the same height', () => {
    const { rerender, container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} loading />,
    );
    const figure = screen.getByRole('figure');
    expect(figure.getAttribute('aria-busy')).toBe('true');
    expect(within(figure).getByText('圖表載入中')).toBeTruthy();
    expect(container.querySelector('[data-chart]')).toBeNull();

    rerender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <BarChart title="營收" data={[]} categoryKey="category" series={SERIES} />
      </BrumeProvider>,
    );
    expect(screen.getByText('目前沒有資料')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('plays the grow-in only when motion is allowed', () => {
    mockReducedMotion(false);
    const { container, unmount } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    expect(container.querySelector('[data-bar-group]')?.getAttribute('class')).toContain(
      'br-chart-grow-y',
    );
    unmount();

    mockReducedMotion(true);
    const reduced = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    expect(reduced.container.innerHTML).not.toContain('br-chart-grow');
    expect(
      reduced.container.querySelector('[data-bar-group]')?.getAttribute('style'),
    ).not.toContain('animation-delay');
  });
});

describe('curves', () => {
  it('monotone curve never overshoots monotone data', () => {
    const d = monotonePath([
      [0, 100],
      [10, 90],
      [20, 10],
      [30, 0],
    ]);
    const ys = [...d.matchAll(/[ ,](-?[\d.]+)(?=[ C]|$)/g)].map((m) => Number(m[1]));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('splits a series at missing values', () => {
    expect(segments([[0, 1], null, [2, 3], [3, 4]])).toEqual([
      [[0, 1]],
      [
        [2, 3],
        [3, 4],
      ],
    ]);
  });
});

const REVENUE = [
  { date: '2026-10-01', revenue: 120000, orders: 300 },
  { date: '2026-10-02', revenue: 98000, orders: null },
  { date: '2026-10-03', revenue: 143000, orders: 410 },
];

describe('LineChart', () => {
  it('formats a time axis in the locale and lists every series in one tooltip', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <LineChart
        title="營收趨勢"
        data={REVENUE}
        xKey="date"
        xType="time"
        series={[
          { key: 'revenue', label: '營收' },
          { key: 'orders', label: '訂單' },
        ]}
        area
      />,
      'en',
    );
    expect(container.querySelectorAll('[data-series] path')).toHaveLength(2);
    expect([...container.querySelectorAll('svg text')].map((t) => t.textContent)).toContain('10/1');

    const plot = screen.getByRole('group', { name: /營收趨勢/ });
    act(() => plot.focus());
    await user.keyboard('{ArrowRight}');
    expect(tooltip(container)?.textContent).toBe('10/298,000營收—訂單');
    // Only the series with a value at that x gets a point.
    expect(container.querySelectorAll('[data-active-point]')).toHaveLength(1);
  });

  it('draws lines in on mount, and not under reduced motion', () => {
    mockReducedMotion(false);
    const { container, unmount } = renderChart(
      <LineChart
        title="營收"
        data={REVENUE}
        xKey="date"
        series={[{ key: 'revenue', label: '營收' }]}
      />,
    );
    expect(container.innerHTML).toContain('br-chart-draw');
    unmount();
    mockReducedMotion(true);
    const reduced = renderChart(
      <LineChart
        title="營收"
        data={REVENUE}
        xKey="date"
        series={[{ key: 'revenue', label: '營收' }]}
      />,
    );
    expect(reduced.container.innerHTML).not.toContain('br-chart-draw');
  });
});

const STATUS = [
  { label: '已完成', value: 620 },
  { label: '處理中', value: 210 },
  { label: '待付款', value: 120 },
  { label: '已取消', value: 50 },
];

describe('DonutChart', () => {
  it('shows the total in the centre and describes the largest slice', () => {
    renderChart(<DonutChart title="訂單狀態" data={STATUS} centerLabel="筆訂單" animate={false} />);
    const figure = screen.getByRole('figure', { name: '訂單狀態' });
    expect(describedBy(figure)).toBe('共 4 項，總計 1,000，最多的是 已完成（62%）。');
    expect(within(figure).getByText('筆訂單')).toBeTruthy();
    expect(within(figure).getAllByText('1,000').length).toBeGreaterThan(0);
  });

  it('legend toggles slices, recomputing total and shares, keeping one', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <DonutChart title="訂單狀態" data={STATUS} animate={false} />,
    );
    await user.click(screen.getByRole('button', { name: /已完成/ }));
    expect(container.querySelectorAll('[data-chart="donut"] path[data-series]')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /處理中/ }).textContent).toBe('處理中55.3%');
    for (const name of [/處理中/, /待付款/]) await user.click(screen.getByRole('button', { name }));
    const last = screen.getByRole('button', { name: /已取消/ });
    expect(last.getAttribute('aria-disabled')).toBe('true');
    await user.click(last);
    expect(container.querySelectorAll('[data-chart="donut"] path[data-series]')).toHaveLength(1);
  });

  it('folds slices past the limit into 「其他」', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label, i) => ({
      label,
      value: 10 - i,
    }));
    renderChart(<DonutChart title="分類" data={many} maxSlices={6} animate={false} />);
    const legend = screen.getByRole('list', { name: /圖例/ });
    expect(within(legend).getAllByRole('button')).toHaveLength(6);
    expect(within(legend).getByRole('button', { name: /其他/ }).textContent).toBe('其他23.1%');
  });

  it('keyboard steps through slices with a tooltip', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <DonutChart title="訂單狀態" data={STATUS} animate={false} />,
    );
    act(() => screen.getByRole('group', { name: /訂單狀態/ }).focus());
    expect(tooltip(container)?.textContent).toBe('已完成62062%');
    await user.keyboard('{ArrowLeft}{End}');
    expect(tooltip(container)?.textContent).toContain('已取消');
  });

  it('is empty when every value is zero', () => {
    renderChart(<DonutChart title="訂單狀態" data={[{ label: 'A', value: 0 }]} />);
    expect(screen.getByText('目前沒有資料')).toBeTruthy();
  });
});

describe('pointer and touch', () => {
  it('a tap activates the tapped category, not the first, and is not announced', () => {
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    const plot = container.querySelector('[data-chart="bar"]') as HTMLElement;
    fireEvent.pointerDown(plot, { clientX: 600, clientY: 100, pointerType: 'touch' });
    act(() => plot.focus());
    expect(tooltip(container)?.textContent).toContain('3C');
    expect(container.querySelector('[aria-live]')?.textContent).toBe('');
    // The finger lifting fires pointerleave; the tapped item stays.
    fireEvent.pointerLeave(plot, { pointerType: 'touch' });
    expect(tooltip(container)?.textContent).toContain('3C');
  });

  it('a tap on a line chart picks the nearest x', () => {
    const { container } = renderChart(
      <LineChart
        title="營收"
        data={REVENUE}
        xKey="date"
        series={[{ key: 'revenue', label: '營收' }]}
      />,
    );
    const plot = container.querySelector('[data-chart="line"]') as HTMLElement;
    fireEvent.pointerDown(plot, { clientX: 630, clientY: 50, pointerType: 'touch' });
    act(() => plot.focus());
    expect(tooltip(container)?.textContent).toContain('143,000');
  });

  it('a tap on a donut slice activates that slice', () => {
    const { container } = renderChart(
      <DonutChart title="訂單狀態" data={STATUS} animate={false} />,
    );
    const plot = container.querySelector('[data-chart="donut"]') as HTMLElement;
    const slice = container.querySelector('path[data-series="處理中"]') as SVGPathElement;
    fireEvent.pointerDown(slice, { pointerType: 'touch' });
    act(() => plot.focus());
    expect(tooltip(container)?.textContent).toContain('處理中');
  });
});

describe('BarChart geometry', () => {
  it('grows negative bars down from the zero line', () => {
    const { container } = renderChart(
      <BarChart
        title="損益"
        data={[
          { m: '1月', v: 1200 },
          { m: '2月', v: -800 },
        ]}
        categoryKey="m"
        series={[{ key: 'v', label: '損益' }]}
      />,
      'en',
    );
    const zero = [...container.querySelectorAll('svg text')].find((t) => t.textContent === '0');
    const zeroY = Number(zero?.getAttribute('y'));
    const [up, down] = [...container.querySelectorAll<SVGPathElement>('[data-bar-group] path')];
    // Both paths start on the zero line and run up (positive) or down (negative) from it.
    const start = (d: string) => (/^M[\d.]+,([\d.]+)V([\d.]+)/.exec(d) ?? []).slice(1).map(Number);
    const [upBase, upEnd] = start(up?.getAttribute('d') ?? '');
    const [downBase, downEnd] = start(down?.getAttribute('d') ?? '');
    expect(Math.abs((upBase as number) - zeroY)).toBeLessThan(1);
    expect(Math.abs((downBase as number) - zeroY)).toBeLessThan(1);
    expect(upEnd).toBeLessThan(zeroY);
    expect(downEnd).toBeGreaterThan(zeroY);
    expect([...container.querySelectorAll('svg text')].map((t) => t.textContent)).toContain('-1K');
  });

  it('gives the rounded end to the real top segment when a zero series is stacked above it', () => {
    const { container } = renderChart(
      <BarChart
        title="營收"
        data={[{ c: 'A', a: 500, b: 300, z: 0 }]}
        categoryKey="c"
        series={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
          { key: 'z', label: 'Z' },
        ]}
        layout="stacked"
      />,
    );
    const top = container.querySelector('path[data-series="b"]')?.getAttribute('d') ?? '';
    const bottom = container.querySelector('path[data-series="a"]')?.getAttribute('d') ?? '';
    expect(top).toContain('Q');
    expect(bottom).not.toContain('Q');
    expect(container.querySelector('path[data-series="z"]')).toBeNull();
  });

  it('drops a stacked segment thinner than the gap instead of flipping it', () => {
    const { container } = renderChart(
      <BarChart
        title="營收"
        data={[{ c: 'A', a: 1000, b: 1 }]}
        categoryKey="c"
        series={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
        layout="stacked"
      />,
    );
    expect(container.querySelector('path[data-series="b"]')).toBeNull();
  });

  it('lays horizontal bars out with categories on the left and steps them with arrows', async () => {
    const user = userEvent.setup();
    const { container } = renderChart(
      <BarChart
        title="熱銷"
        data={[
          { n: '耳機', u: 1284 },
          { n: '背包', u: 702 },
        ]}
        categoryKey="n"
        series={[{ key: 'u', label: '件數' }]}
        orientation="horizontal"
      />,
    );
    const label = [...container.querySelectorAll('svg text')].find((t) => t.textContent === '耳機');
    expect(label?.getAttribute('text-anchor')).toBe('end');
    const bar = container.querySelector('path[data-series="u"]')?.getAttribute('d') ?? '';
    // Rounded at the right (data) end: the curve sits at the far x.
    expect(bar).toMatch(/Q/);
    act(() => (container.querySelector('[data-chart="bar"]') as HTMLElement).focus());
    await user.keyboard('{ArrowDown}');
    expect(tooltip(container)?.textContent).toContain('背包');
  });

  it('formats very large values on the axis without collisions', () => {
    const { container } = renderChart(
      <BarChart
        title="營收"
        data={[
          { c: 'A', v: 2.4e9 },
          { c: 'B', v: 1.25e9 },
        ]}
        categoryKey="c"
        series={[{ key: 'v', label: '營收' }]}
      />,
      'en',
    );
    const ticks = [...container.querySelectorAll('svg text')]
      .map((t) => t.textContent ?? '')
      .filter((t) => /\d/.test(t));
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks).toContain('2B');
  });
});

describe('measuring', () => {
  it('draws nothing until the box has a width, keeping its height', () => {
    vi.restoreAllMocks();
    stubLayoutWidth(0);
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} height={200} />,
    );
    const plot = container.querySelector('[data-chart="bar"]') as HTMLElement;
    expect(plot.style.height).toBe('200px');
    expect(plot.querySelector('svg')).toBeNull();
  });

  it('re-lays the chart out when ResizeObserver reports a new width', () => {
    let notify: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const resize = stubLayoutWidth(640);
    const { container } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('640');
    resize(320);
    act(() => notify());
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('320');
  });
});

describe('hidden series and slices', () => {
  it('prunes stale keys and never hides every series', () => {
    expect([...pruneHidden(new Set(['gone', 'a']), ['a', 'b'], ['a', 'b'])]).toEqual(['a']);
    expect([...pruneHidden(new Set(['a']), ['a'], ['a'])]).toEqual([]);
  });

  it('a series hidden earlier cannot blank the chart when it is the only one left', async () => {
    const user = userEvent.setup();
    const { container, rerender } = renderChart(
      <BarChart title="營收" data={SALES} categoryKey="category" series={SERIES} />,
    );
    await user.click(screen.getByRole('button', { name: '線上' }));
    rerender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <BarChart title="營收" data={SALES} categoryKey="category" series={[SERIES[0] as never]} />
      </BrumeProvider>,
    );
    expect(container.querySelectorAll('path[data-series="online"]')).toHaveLength(3);
  });

  it('the donut keeps one non-zero slice visible; zero slices do not count', async () => {
    const user = userEvent.setup();
    renderChart(
      <DonutChart
        title="狀態"
        data={[
          { label: 'A', value: 10 },
          { label: 'B', value: 0 },
        ]}
        animate={false}
      />,
    );
    const a = screen.getByRole('button', { name: /^A/ });
    expect(a.getAttribute('aria-disabled')).toBe('true');
    await user.click(a);
    expect(a.getAttribute('aria-pressed')).toBe('true');
    const b = screen.getByRole('button', { name: /^B/ });
    expect(b.hasAttribute('aria-disabled')).toBe(false);
  });

  it('folds the smallest slices, wherever they are listed, keeping input order', () => {
    const data = [
      { label: 'tiny', value: 1 },
      { label: 'big', value: 50 },
      { label: 'mid', value: 20 },
      { label: 'small', value: 2 },
      { label: 'large', value: 40 },
    ];
    renderChart(<DonutChart title="分類" data={data} maxSlices={4} animate={false} />);
    const legend = screen.getByRole('list', { name: /圖例/ });
    expect(
      within(legend)
        .getAllByRole('button')
        .map((b) => b.textContent?.replace(/[\d.%]+$/, '')),
    ).toEqual(['big', 'mid', 'large', '其他']);
  });

  it('accepts numeric strings (PHP DECIMAL) for donut values', () => {
    renderChart(
      <DonutChart
        title="狀態"
        data={[
          { label: 'A', value: '600.50' },
          { label: 'B', value: '399.50' },
        ]}
        animate={false}
      />,
    );
    expect(describedBy(screen.getByRole('figure'))).toBe(
      '共 2 項，總計 1,000，最多的是 A（60.1%）。',
    );
  });
});
