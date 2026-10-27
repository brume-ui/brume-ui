import type { LayoutSettings, MenuItem } from '@brume-ui/brume-schema';
import type { ReactNode } from 'react';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { AppShell, type AppShellProps } from './app-shell';

export const MENU: MenuItem[] = [
  { title: '儀表板', icon: 'layout-dashboard', url: '/admin' },
  {
    title: '內容',
    icon: 'file-text',
    children: [
      { title: '使用者', url: '/admin/users' },
      { title: '文章', url: '/admin/posts' },
    ],
  },
  { title: '未知圖示', icon: 'no-such-icon', url: '/admin/misc' },
];

export const LAYOUT: LayoutSettings = {
  menuPosition: 'side',
  accent: '#0e7490',
  sidebarCollapsible: true,
  breadcrumbs: true,
};

export function renderShell(
  props: Partial<AppShellProps> = {},
  adapter = createMemoryAdapter('/admin/users'),
): { adapter: typeof adapter; ui: (extra?: Partial<AppShellProps>) => ReactNode } {
  const ui = (extra: Partial<AppShellProps> = {}) => (
    <BrumeProvider adapter={adapter}>
      <AppShell
        appName="Brume"
        menu={MENU}
        currentUrl="/admin/users"
        user={{ name: 'Herb' }}
        breadcrumbs={[{ title: '首頁', url: '/admin' }, { title: '使用者' }]}
        layout={LAYOUT}
        logoutUrl="/admin/logout"
        {...props}
        {...extra}
      >
        <p>內容</p>
      </AppShell>
    </BrumeProvider>
  );
  return { adapter, ui };
}
