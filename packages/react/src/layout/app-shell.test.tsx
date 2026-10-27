import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT, renderShell } from './fixtures';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('AppShell', () => {
  it('menuPosition=top has no sidebar but a horizontal menu with dropdown children', async () => {
    const { adapter, ui } = renderShell({ layout: { ...LAYOUT, menuPosition: 'top' } });
    render(ui());
    expect(document.querySelector('aside')).toBeNull();
    expect(document.querySelector('[data-shell-mount]')).toBeNull();
    const nav = screen.getByRole('navigation', { name: '主選單' });
    expect(within(nav).getByRole('link', { name: '儀表板' })).toBeTruthy();
    await userEvent.click(within(nav).getByRole('button', { name: /內容/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: '文章' }));
    expect(adapter.calls).toContainEqual({ fn: 'visit', args: ['/admin/posts'] });
  });

  it('breadcrumbs=false renders no breadcrumb', () => {
    const { ui } = renderShell({ layout: { ...LAYOUT, breadcrumbs: false } });
    render(ui());
    expect(screen.queryByRole('navigation', { name: '麵包屑' })).toBeNull();
  });

  it('renders breadcrumbs with the last as current page and links via adapter', async () => {
    const { adapter, ui } = renderShell();
    render(ui());
    const crumbs = screen.getByRole('navigation', { name: '麵包屑' });
    expect(within(crumbs).getByText('使用者').getAttribute('aria-current')).toBe('page');
    await userEvent.click(within(crumbs).getByRole('link', { name: '首頁' }));
    expect(adapter.calls).toContainEqual({ fn: 'visit', args: ['/admin'] });
  });

  it('logout submits a POST to logoutUrl', async () => {
    const { adapter, ui } = renderShell();
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: /使用者選單/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: '登出' }));
    expect(adapter.calls).toContainEqual({ fn: 'submit', args: ['post', '/admin/logout', {}] });
  });

  it('hides the user menu when there is no user', () => {
    render(renderShell({ user: null }).ui());
    expect(screen.queryByRole('button', { name: /使用者選單/ })).toBeNull();
  });

  it('writes accent to --br-accent on the shell root', () => {
    render(renderShell({ layout: { ...LAYOUT, accent: '#aa3366' } }).ui());
    const root = document.querySelector('[data-brume]') as HTMLElement;
    expect(root.style.getPropertyValue('--br-accent')).toBe('#aa3366');
  });

  it('switches color scheme', async () => {
    render(renderShell().ui());
    await userEvent.click(screen.getByRole('button', { name: '色彩模式' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '深色' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('brume.color-scheme')).toBe('dark');
  });

  it('shows the language switcher only with onLocaleChange', async () => {
    const { ui } = renderShell();
    const view = render(ui());
    expect(screen.queryByRole('button', { name: '語言' })).toBeNull();
    const onLocaleChange = vi.fn();
    view.rerender(ui({ onLocaleChange }));
    await userEvent.click(screen.getByRole('button', { name: '語言' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'English' }));
    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });

  it('opens the mobile drawer from the menu button', async () => {
    const { adapter, ui } = renderShell();
    render(ui());
    await userEvent.click(screen.getByRole('button', { name: '選單' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('link', { name: '文章' }));
    expect(adapter.calls).toContainEqual({ fn: 'visit', args: ['/admin/posts'] });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
