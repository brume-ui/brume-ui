/** App fixture DOM tests live here because Playground's own suite uses Node. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../../apps/playground/src/app';
import { DemoGuide, useDemoExample } from '../../../apps/playground/src/pages/demo-guide';

function selectHash(hash: string) {
  act(() => {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
afterEach(() => window.history.replaceState(null, '', '#/'));

function Example() {
  const selected = useDemoExample(['first', 'second'], 'first');
  return <output aria-label="目前範例">{selected}</output>;
}

it('updates a mounted example on same-route hash changes and visibly falls back for unknown IDs', () => {
  selectHash('#/form-fields?example=second');
  render(<Example />);
  expect(screen.getByLabelText('目前範例').textContent).toBe('second');
  selectHash('#/form-fields?example=first');
  expect(screen.getByLabelText('目前範例').textContent).toBe('first');
  selectHash('#/form-fields?example=unknown');
  expect(screen.getByLabelText('目前範例').textContent).toBe('first');
  selectHash('#/form-fields');
  expect(screen.getByLabelText('目前範例').textContent).toBe('first');
});

it('renders guide instructions and preserves its content when an ID is unknown', () => {
  const { rerender } = render(
    <DemoGuide featureId="form.remote-options">
      <p>操作內容</p>
    </DemoGuide>,
  );
  expect(screen.getByText('操作步驟')).toBeTruthy();
  expect(screen.getByText(/重新整理後重置/)).toBeTruthy();
  rerender(
    <DemoGuide featureId="missing">
      <p>操作內容</p>
    </DemoGuide>,
  );
  expect(screen.getByText('操作內容')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('找不到功能說明');
});

it('lands on the catalog, filters real destinations and retains settings and old routes', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  selectHash('#/');
  render(<App />);
  expect(screen.getByTestId('pg-index')).toBeTruthy();
  expect(screen.getByRole('heading', { name: '功能示範目錄' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜尋功能' }), {
    target: { value: '遠端' },
  });
  expect(screen.getByRole('link', { name: '遠端選項與關聯挑選' }).getAttribute('href')).toBe(
    '#/form-relations',
  );
  fireEvent.change(screen.getByRole('combobox', { name: '功能分類' }), {
    target: { value: 'grid' },
  });
  expect(screen.getByText('找不到符合條件的示範。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
  expect(screen.getByRole('link', { name: '按鈕狀態' })).toBeTruthy();
  selectHash('#/checkbox');
  expect(screen.getByTestId('pg-checkbox')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Brume Playground' })).toBeTruthy();
  selectHash('#/unknown?example=anything');
  expect(screen.getByRole('heading', { name: '功能示範目錄' })).toBeTruthy();
});
