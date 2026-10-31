import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../apps/playground/src/app';
import { FormConditionsPage } from '../../../apps/playground/src/pages/form-conditions';
import { FocusedFormDemo } from '../../../apps/playground/src/pages/form-feature-demo';
import * as focusedMemory from '../../../apps/playground/src/pages/form-feature-memory';
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
  it.each(['integer', 'coupon'])(
    'keeps %s Save pointer activation stable until click validates and focuses the error',
    async (kind) => {
      const user = userEvent.setup();
      renderWithBrume(
        kind === 'integer' ? (
          <FocusedFormDemo exampleId="form.rule.integer" />
        ) : (
          <FormConditionsPage />
        ),
      );
      if (kind === 'coupon') await user.click(screen.getByRole('radio', { name: '優惠券' }));
      const input = screen.getByLabelText(kind === 'integer' ? '整數文字' : /^優惠券代碼/);
      await user.click(input);
      fireEvent.change(input, { target: { value: kind === 'integer' ? '1.5' : '' } });
      const save = screen.getByRole('button', {
        name: kind === 'integer' ? '儲存後繼續編輯' : '儲存贈品設定',
      });
      // A real mousedown used to blur/touch the invalid input and insert the summary,
      // shifting the button before mouseup. Keep pointer-down separate from click.
      await user.pointer({ target: save, keys: '[MouseLeft>]' });
      expect(document.activeElement).toBe(input);
      expect(screen.queryByRole('alert')).toBeNull();
      await user.pointer({ target: save, keys: '[/MouseLeft]' });
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').textContent).toContain(
        kind === 'integer' ? '請輸入整數。' : '請輸入優惠券代碼。',
      );
      await screen.findByText('未完成儲存同步；保留目前草稿。');
    },
  );

  it.each([false, true])(
    'restores an abandoned initiator after disabled blur without stealing newer focus (%s)',
    async (newFocus) => {
      // Exercise a frame before React commits cleanup after the native blur shown in the trace.
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        queueMicrotask(() => callback(performance.now()));
        return 1;
      });
      let rejectSave: (error: Error) => void = () => {
        throw new Error('Save not started');
      };
      const original = focusedMemory.createFocusedAdapter;
      const server = vi
        .spyOn(focusedMemory, 'createFocusedAdapter')
        .mockImplementation((...args) => {
          const adapter = original(...args);
          return {
            ...adapter,
            request: (request) =>
              request.url === '/demo/focused/save'
                ? new Promise((_resolve, reject) => {
                    rejectSave = reject;
                  })
                : adapter.request(request),
          };
        });
      try {
        renderWithBrume(<FocusedFormDemo exampleId="form.behavior.submit-network" />);
        fireEvent.change(screen.getByLabelText('名稱'), { target: { value: '重試草稿' } });
        fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'network' } });
        const save = screen.getByRole('button', { name: '儲存後繼續編輯' });
        save.focus();
        await act(async () => {
          fireEvent.click(save);
          // jsdom retains focus on disabled controls; Chromium clears it, as the trace shows.
          expect(save).toHaveProperty('disabled', true);
          document.body.tabIndex = -1;
          document.body.focus();
          expect(document.activeElement).toBe(document.body);
          if (newFocus) screen.getByLabelText('模擬回應').focus();
        });
        await act(async () => {
          rejectSave(new Error('remote network failure'));
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });
        await waitFor(() => expect(save).toHaveProperty('disabled', false));
        await waitFor(() =>
          expect(document.activeElement).toBe(newFocus ? screen.getByLabelText('模擬回應') : save),
        );
      } finally {
        document.body.removeAttribute('tabindex');
        vi.unstubAllGlobals();
        server.mockRestore();
      }
    },
  );

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
