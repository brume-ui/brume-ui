import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows title, description and next-step action', () => {
    render(
      <EmptyState
        title="還沒有文章"
        description="建立第一篇文章後會顯示在這裡。"
        action={<button type="button">新增文章</button>}
        icon={Inbox}
      />,
    );
    expect(screen.getByText('還沒有文章')).toBeTruthy();
    expect(screen.getByText('建立第一篇文章後會顯示在這裡。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新增文章' })).toBeTruthy();
  });

  it('renders without icon or action', () => {
    render(<EmptyState title="沒有結果" description="換個關鍵字再試試。" />);
    expect(screen.getByText('沒有結果')).toBeTruthy();
  });

  it('can lead with a large muted code and make the title a heading', () => {
    render(
      <EmptyState code={404} titleAs="h1" title="找不到這個頁面" description="網址可能打錯了。" />,
    );
    expect(screen.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeTruthy();
    const code = screen.getByText('404');
    expect(code.className).toContain('br:tabular-nums');
    expect(code.className).toContain('br:text-text-muted');
  });
});
