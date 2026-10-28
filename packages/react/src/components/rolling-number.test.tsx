import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { mockReducedMotion } from '../motion/test-utils';
import { BrumeProvider } from '../provider';
import { RollingNumber, rollingParts } from './rolling-number';

function renderNumber(ui: React.ReactElement, locale: 'zh-TW' | 'en' = 'zh-TW') {
  return render(
    <BrumeProvider adapter={createMemoryAdapter()} locale={locale}>
      {ui}
    </BrumeProvider>,
  );
}

function digits(container: HTMLElement): string {
  return [...container.querySelectorAll('[data-digit]')]
    .map((el) => (el as HTMLElement).dataset.digit)
    .join('');
}

const nextFrames = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

describe('rollingParts', () => {
  it('splits digits from separators and keys digit columns from the right', () => {
    const parts = rollingParts('12,345');
    expect(parts.map((p) => (p.kind === 'digit' ? p.digit : p.char))).toEqual([1, 2, ',', 3, 4, 5]);
    expect(parts.filter((p) => p.kind === 'digit').map((p) => p.key)).toEqual([
      'd4',
      'd3',
      'd2',
      'd1',
      'd0',
    ]);
  });

  it('keeps the units column key when the number gains a digit', () => {
    const units = (s: string) => rollingParts(s).at(-1)?.key;
    expect(units('99')).toBe(units('100'));
  });

  it('handles currency, percent and minus signs as static characters', () => {
    const kinds = rollingParts('-NT$1.5%').map((p) => p.kind);
    expect(kinds).toEqual(['char', 'char', 'char', 'char', 'digit', 'char', 'digit', 'char']);
  });
});

describe('RollingNumber', () => {
  it('formats with the provider locale and exposes the plain value to assistive tech', () => {
    renderNumber(<RollingNumber value={24182} animateOnMount={false} />, 'en');
    expect(screen.getByText('24,182').className).toContain('sr-only');
  });

  it('accepts Intl options and an explicit locale', () => {
    renderNumber(
      <RollingNumber
        value={0.125}
        locale="en"
        format={{ style: 'percent', maximumFractionDigits: 1 }}
        animateOnMount={false}
      />,
    );
    expect(screen.getByText('12.5%')).toBeTruthy();
  });

  it('rolls up from zeros after mount', async () => {
    mockReducedMotion(false);
    const { container } = renderNumber(<RollingNumber value={407} />);
    expect(digits(container)).toBe('000');
    await nextFrames();
    expect(digits(container)).toBe('407');
  });

  it('shows the value at once under reduced motion', () => {
    mockReducedMotion(true);
    const { container } = renderNumber(<RollingNumber value={407} />);
    expect(digits(container)).toBe('407');
  });

  it('rolls existing columns to a new value', () => {
    const { container, rerender } = renderNumber(
      <RollingNumber value={95} animateOnMount={false} />,
    );
    const units = container.querySelector('[data-digit]:last-of-type');
    rerender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <RollingNumber value={96} animateOnMount={false} />
      </BrumeProvider>,
    );
    expect(digits(container)).toBe('96');
    expect(units?.isConnected).toBe(true);
  });
});
