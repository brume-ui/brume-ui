import type { SharedProps } from '@brume-ui/brume-schema';

export function makeShared(overrides: Partial<SharedProps['brume']> = {}): SharedProps['brume'] {
  return {
    schemaVersion: '0.1',
    app: {
      name: 'Brume Admin',
      locale: 'zh-TW',
      locales: ['zh-TW', 'en', 'zh-CN'],
      homeUrl: '/admin',
      logoutUrl: '/admin/logout',
      layout: { menuPosition: 'side', accent: '', sidebarCollapsible: true, breadcrumbs: true },
    },
    auth: { user: { id: 1, name: 'Herb', username: 'herb', avatar: null } },
    menu: [{ title: '儀表板', url: '/admin' }],
    breadcrumbs: [],
    flash: null,
    ...overrides,
  };
}
