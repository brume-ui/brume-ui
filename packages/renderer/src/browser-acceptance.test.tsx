import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../apps/playground/src/app';
import { FocusedFormDemo } from '../../../apps/playground/src/pages/form-feature-demo';
import { GridFeaturesPage } from '../../../apps/playground/src/pages/grid-features';
import { renderWithBrume } from './test-utils';

describe('recorded remote browser acceptance regressions', () => {
  it('retains integer error focus after the save button pointer activation finishes', async () => {
    const user = userEvent.setup();
    renderWithBrume(<FocusedFormDemo exampleId="form.rule.integer" />);
    fireEvent.change(screen.getByLabelText('整數文字'), { target: { value: '1.5' } });
    await user.click(screen.getByRole('button', { name: '儲存後繼續編輯' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('整數文字')));
  });
  it('restores the initiating save control after a network failure settles', async () => {
    const user = userEvent.setup();
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.submit-network" />);
    fireEvent.change(screen.getByLabelText('名稱'), { target: { value: '重試草稿' } });
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'network' } });
    const save = screen.getByRole('button', { name: '儲存後繼續編輯' });
    save.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    await waitFor(() => expect(document.activeElement).toBe(save));
  });
  it('keeps an inline textarea 422 visible and described by the restored edit button', async () => {
    const user = userEvent.setup();
    window.location.hash = '/grid-features?example=grid.editor.textarea';
    renderWithBrume(<GridFeaturesPage />);
    const row = screen
      .getAllByRole('row')
      .find((node) => node.textContent?.includes('ORD-2610024')) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^編輯備註/ }));
    await user.type(within(row).getByRole('textbox', { name: '備註' }), '長'.repeat(201));
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(screen.getByTestId('grid-events').textContent).toContain('422'));
    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('備註最多 200 個字。');
    expect(
      within(row)
        .getByRole('button', { name: /^編輯備註/ })
        .getAttribute('aria-describedby'),
    ).toBe(error.id);
  });
  it.each(['grid', 'grid-empty', 'shell'])(
    'places the %s skip navigation before demo destination links',
    (route) => {
      window.location.hash = `/${route}`;
      renderWithBrume(<App />);
      const skip = screen.getByRole('link', { name: '跳到主要內容' });
      const guide = screen.getByRole('complementary', { name: '示範操作說明' });
      expect(skip.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(document.getElementById(skip.getAttribute('href')?.slice(1) ?? '')).toBeTruthy();
    },
  );
});
