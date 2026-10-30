/** Exercises the actual Playground composition, not a hand-built resource page. */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { GridPage } from '../../../apps/playground/src/pages/grid';
import { SettingsProvider } from '../../../apps/playground/src/settings';
import { renderWithBrume } from './test-utils';

it('playground grid exposes resource creation, quick create and real row edit dialogs', async () => {
  renderWithBrume(
    <SettingsProvider route="grid">
      <GridPage />
    </SettingsProvider>,
  );
  expect(screen.getByRole('button', { name: '新增訂單' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '快速新增' }));
  expect(screen.getByRole('textbox', { name: '客戶' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ORD-2610048' }));
  const dialog = await screen.findByRole('dialog', { name: '編輯訂單' });
  expect(within(dialog).getByText(/#A1048/)).toBeTruthy();
  expect(within(dialog).getByRole('textbox', { name: '標題' })).toBeTruthy();
});

it('playground menu E opens a loaded edit dialog and Escape restores the menu trigger', async () => {
  const user = userEvent.setup();
  renderWithBrume(
    <SettingsProvider route="grid">
      <GridPage />
    </SettingsProvider>,
  );
  const more = screen.getByRole('button', { name: 'ORD-2610048 的更多操作' });
  await user.click(more);
  await user.keyboard('e');
  const dialog = await screen.findByRole('dialog', { name: '編輯訂單' });
  expect(within(dialog).getByText(/#A1048/)).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(more));
});
