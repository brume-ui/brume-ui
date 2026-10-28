import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { mockReducedMotion } from '../motion/test-utils';
import { BrumeProvider } from '../provider';
import { Sparkline } from './sparkline';
import { deltaDirection, StatCard } from './stat-card';
import { stubLayoutWidth } from './test-width';

beforeEach(() => {
  stubLayoutWidth();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderCard(ui: ReactElement, locale: 'zh-TW' | 'en' = 'zh-TW') {
  return render(
    <BrumeProvider adapter={createMemoryAdapter()} locale={locale}>
      {ui}
    </BrumeProvider>,
  );
}

const TWD = { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 } as const;

describe('StatCard', () => {
  it('is a group named by its label, showing the formatted value', () => {
    renderCard(<StatCard label="本月營收" value={1284000} format={TWD} animate={false} />, 'en');
    const card = screen.getByRole('group', { name: '本月營收' });
    expect(within(card).getByText('NT$1,284,000').className).toContain('sr-only');
  });

  it('shows a rise with an up icon, a plus sign and words, not colour alone', () => {
    const { container } = renderCard(
      <StatCard
        label="訂單"
        value={312}
        delta={{ value: 0.124, period: '上月' }}
        animate={false}
      />,
    );
    const badge = container.querySelector('[data-delta]') as HTMLElement;
    expect(badge.dataset.delta).toBe('up');
    expect(badge.dataset.tone).toBe('good');
    expect(badge.textContent).toBe('+12.4%');
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('較上月增加 12.4%').className).toContain('sr-only');
    expect(screen.getByText('較上月')).toBeTruthy();
  });

  it('uses a true minus for a fall and the bad tone when up is good', () => {
    const { container } = renderCard(
      <StatCard label="訂單" value={280} delta={{ value: -0.031 }} animate={false} />,
    );
    const badge = container.querySelector('[data-delta]') as HTMLElement;
    expect(badge.textContent).toBe('−3.1%');
    expect(badge.dataset.tone).toBe('bad');
    expect(screen.getByText('較上期減少 3.1%')).toBeTruthy();
  });

  it('treats a falling metric as good news when `good` is down', () => {
    const { container } = renderCard(
      <StatCard
        label="退款率"
        value={0.02}
        delta={{ value: -0.2, good: 'down' }}
        animate={false}
      />,
    );
    expect((container.querySelector('[data-delta]') as HTMLElement).dataset.tone).toBe('good');
  });

  it('shows no change as flat and neutral', () => {
    const { container } = renderCard(
      <StatCard
        label="會員"
        value={10}
        delta={{ value: 0.0001, period: '上週' }}
        animate={false}
      />,
      'en',
    );
    const badge = container.querySelector('[data-delta]') as HTMLElement;
    expect(badge.dataset.delta).toBe('flat');
    expect(badge.dataset.tone).toBe('neutral');
    expect(screen.getByText('Unchanged vs 上週')).toBeTruthy();
    expect(deltaDirection(0)).toBe('flat');
  });

  it('describes its sparkline for screen readers', () => {
    renderCard(<StatCard label="營收" value={5} trend={[3, 1, 4, 1, 5]} animate={false} />);
    expect(screen.getByRole('img', { name: '營收趨勢：由 3 到 5，最低 1，最高 5' })).toBeTruthy();
  });

  it('loading keeps the layout with skeletons and no value', () => {
    const { container } = renderCard(
      <StatCard label="營收" value={5} trend={[1, 2]} delta={{ value: 0.1 }} loading />,
    );
    const card = screen.getByRole('group', { name: '營收' });
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[data-rolling-number]')).toBeNull();
    expect(container.querySelector('[data-delta]')).toBeNull();
    expect(
      container.querySelectorAll('[aria-hidden="true"].br\\:block').length,
    ).toBeGreaterThanOrEqual(3);
    expect(within(card).getByText('載入中')).toBeTruthy();
  });

  it('does not roll the value or draw the sparkline under reduced motion', () => {
    mockReducedMotion(true);
    const { container } = renderCard(<StatCard label="營收" value={42} trend={[1, 2, 3]} />);
    expect(
      [...container.querySelectorAll('[data-digit]')].map((d) => (d as HTMLElement).dataset.digit),
    ).toEqual(['4', '2']);
    expect(container.innerHTML).not.toContain('br-chart-draw');
  });
});

describe('numeric strings from PHP', () => {
  it('StatCard and its sparkline accept DECIMAL strings', () => {
    renderCard(
      <StatCard
        label="營收"
        value="1284000.00"
        delta={{ value: '0.124' }}
        trend={['3', '1.5', 'n/a', '5']}
        animate={false}
      />,
      'en',
    );
    expect(screen.getByText('1,284,000').className).toContain('sr-only');
    expect(screen.getByText('Up 12.4% vs previous period')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: '營收 trend: from 3 to 5, low 1.5, high 5' }),
    ).toBeTruthy();
  });
});

describe('Sparkline', () => {
  it('draws nothing until its box is measured', () => {
    vi.restoreAllMocks();
    stubLayoutWidth(0);
    const { container } = renderCard(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector('svg')).toBeNull();
    expect((container.querySelector('[data-sparkline]') as HTMLElement).style.height).toBe('36px');
  });

  it('is decorative without a label', () => {
    const { container } = renderCard(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector('[data-sparkline]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
