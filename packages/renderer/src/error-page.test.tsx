import type { ErrorPage } from '@brume-ui/brume-schema';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ErrorPageView } from './error-page';
import { renderWithBrume } from './test-utils';

const notFound: ErrorPage = {
  type: 'error',
  status: 404,
  title: '找不到這個頁面',
  message: '網址可能打錯了，或這個頁面已經移除。',
};

describe('ErrorPageView', () => {
  it('shows the status, a heading, the message and 「回到首頁」', () => {
    renderWithBrume(<ErrorPageView page={notFound} />);
    expect(screen.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeTruthy();
    expect(screen.getByText('網址可能打錯了，或這個頁面已經移除。')).toBeTruthy();
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByRole('link', { name: '回到首頁' }).getAttribute('href')).toBe('/');
  });

  it('「回到首頁」 visits through the adapter', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<ErrorPageView page={notFound} />);
    await user.click(screen.getByRole('link', { name: '回到首頁' }));
    expect(adapter.calls.filter((c) => c.fn === 'visit').map((c) => c.args[0])).toEqual(['/']);
  });

  it("uses the page's own action when it has one", async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(
      <ErrorPageView
        page={{ ...notFound, action: { label: '回到訂單列表', url: '/admin/orders' } }}
      />,
    );
    await user.click(screen.getByRole('link', { name: '回到訂單列表' }));
    expect(adapter.calls.at(-1)?.args[0]).toBe('/admin/orders');
  });
});
