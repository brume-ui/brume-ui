import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Circle, LayoutDashboard } from 'lucide-react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from './app-shell';
import { LAYOUT, MENU, renderShell } from './fixtures';
import { findCurrentItem, resolveIcon } from './menu-utils';

beforeEach(() => localStorage.clear());

function sidebar() {
  return document.querySelector('aside') as HTMLElement;
}

describe('Sidebar', () => {
  it('marks the current item and expands its parent', () => {
    render(renderShell().ui());
    const nav = within(sidebar());
    expect(nav.getByRole('link', { name: '使用者' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('button', { name: '內容' }).getAttribute('aria-expanded')).toBe('true');
    expect(nav.getByRole('link', { name: '文章' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps parents without the current page collapsed and toggles them', async () => {
    render(renderShell({ currentUrl: '/admin' }).ui());
    const group = within(sidebar()).getByRole('button', { name: '內容' });
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(within(sidebar()).queryByRole('link', { name: '使用者' })).toBeNull();
    await userEvent.click(group);
    expect(within(sidebar()).getByRole('link', { name: '使用者' })).toBeTruthy();
  });

  it('visits through the adapter but keeps a real href and ignores modified clicks', async () => {
    const { adapter, ui } = renderShell();
    render(ui());
    const link = within(sidebar()).getByRole('link', { name: '文章' });
    expect(link.getAttribute('href')).toBe('/admin/posts');
    await userEvent.click(within(sidebar()).getByRole('link', { name: '使用者' }));
    expect(adapter.calls).toContainEqual({ fn: 'visit', args: ['/admin/users'] });
    adapter.calls.length = 0;
    // stop jsdom from attempting a real navigation after React has had its say
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('click', stop);
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { button: 1 });
    document.removeEventListener('click', stop);
    expect(adapter.calls).toEqual([]);
  });

  it('collapse persists across re-render and remount', async () => {
    const first = render(renderShell().ui());
    await userEvent.click(screen.getByRole('button', { name: '收合側欄' }));
    expect(sidebar().dataset.collapsed).toBe('true');
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('1');
    first.unmount();
    render(renderShell().ui());
    expect(sidebar().dataset.collapsed).toBe('true');
    expect(screen.getByRole('button', { name: '展開側欄' })).toBeTruthy();
    // icon-only: text labels are gone but links keep an accessible name
    expect(within(sidebar()).queryByText('儀表板')).toBeNull();
    expect(within(sidebar()).getByRole('link', { name: '儀表板' })).toBeTruthy();
  });

  it('hides the collapse toggle when not collapsible', () => {
    render(renderShell({ layout: { ...LAYOUT, sidebarCollapsible: false } }).ui());
    expect(screen.queryByRole('button', { name: '收合側欄' })).toBeNull();
  });

  it('keeps the same data-shell-mount across re-renders (persistent layout)', () => {
    const { ui } = renderShell();
    const view = render(ui());
    const id = sidebar().dataset.shellMount;
    expect(id).toBeTruthy();
    view.rerender(ui({ currentUrl: '/admin/posts' }));
    expect(sidebar().dataset.shellMount).toBe(id);
  });
});

describe('menu utils', () => {
  it('matches exact, ignores query, and falls back to longest prefix except home', () => {
    expect(findCurrentItem(MENU, '/admin/users?page=2')?.title).toBe('使用者');
    expect(findCurrentItem(MENU, '/admin/users/5')?.title).toBe('使用者');
    expect(findCurrentItem(MENU, '/admin/usersx')?.title).toBe('儀表板');
    const withHome = [{ title: '首頁', url: '/' }, ...MENU];
    expect(findCurrentItem(withHome, '/nowhere')).toBeNull();
    expect(findCurrentItem(withHome, '/')?.title).toBe('首頁');
  });

  it('resolves kebab-case icons with a Circle fallback', () => {
    expect(resolveIcon('layout-dashboard')).toBe(LayoutDashboard);
    expect(resolveIcon('nope')).toBe(Circle);
    expect(resolveIcon(undefined)).toBe(Circle);
  });
});
