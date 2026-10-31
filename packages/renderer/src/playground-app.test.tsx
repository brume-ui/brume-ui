import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../../apps/playground/src/app';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

function expectGuide(title: string) {
  expect(screen.getAllByRole('complementary', { name: '示範操作說明' })).toHaveLength(1);
  const guide = screen.getByRole('complementary', { name: '示範操作說明' });
  expect(within(guide).getByRole('heading', { level: 2, name: title })).toBeTruthy();
}

it.each([
  ['form-fields', 'form.field.currency', '精確金額', 'form.field.text', '文字'],
  ['form-layouts', 'form.layout.sections-tabs', '頁籤分段', 'form.layout.row', '比例列'],
  [
    'form-behaviors',
    'form.behavior.submit-cancel',
    '取消回應保留草稿',
    'form.behavior.default-value',
    '新列的預設權威值',
  ],
  [
    'grid-features',
    'grid.display.badge',
    'Grid 顯示 · badge',
    'grid.display.link',
    'Grid 顯示 · link',
  ],
])(
  'keeps one selected guide at the App boundary for %s and query changes',
  async (route, selected, title, next, nextTitle) => {
    window.history.replaceState(null, '', `/#/${route}?example=${selected}`);
    render(<App />);
    expectGuide(title);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('選擇聚焦範例'), { target: { value: next } });
    });
    expect(window.location.hash).toBe(`#/${route}?example=${next}`);
    expectGuide(nextTitle);
  },
);

it.each([
  ['form-conditions', '根層三種贈品設定'],
  ['form-composition', '門檻獨立三種贈品設定'],
  ['public-contracts?example=style.tokens', '設計 token 比較'],
  ['button', '按鈕狀態'],
])('renders one route-owned or legacy App-owned guide for %s', (route, title) => {
  window.history.replaceState(null, '', `/#/${route}`);
  render(<App />);
  expectGuide(title);
});
