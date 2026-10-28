import type { LayoutSettings, MenuItem } from '@brume-ui/brume-schema';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { type ReactNode, useCallback, useLayoutEffect, useState } from 'react';
import { cn } from '../cn';
import { IconButton } from '../components/icon-button';
import type { Locale } from '../i18n';
import { OVERLAY_MOTION } from '../motion/classes';
import { useBrume } from '../provider';
import { type BreadcrumbItem, Breadcrumbs } from './breadcrumbs';
import { ColorSchemeMenu, LocaleMenu } from './navbar-menus';
import { Sidebar, SidebarNav } from './sidebar';
import { TopMenu } from './top-menu';
import { type ShellUser, UserMenu } from './user-menu';

const ACCENT_VAR = '--br-accent-custom';
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'brume.sidebar-collapsed';

export interface AppShellProps {
  appName: string;
  menu: MenuItem[];
  currentUrl: string;
  /** Url of the home/dashboard item; it only highlights on an exact match. Default '/'. */
  homeUrl?: string;
  user: ShellUser | null;
  breadcrumbs: BreadcrumbItem[];
  layout: LayoutSettings;
  logoutUrl: string;
  /** When omitted the language switcher is hidden. */
  onLocaleChange?(locale: Locale): void;
  children: ReactNode;
}

function newMountId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the non-crypto id
  }
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell({
  appName,
  menu,
  currentUrl,
  homeUrl = '/',
  user,
  breadcrumbs,
  layout,
  logoutUrl,
  onLocaleChange,
  children,
}: AppShellProps) {
  const { t } = useBrume();
  const [mountId] = useState(newMountId);
  const [storedCollapsed, setStoredCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sideMenu = layout.menuPosition === 'side';
  const collapsed = sideMenu && layout.sidebarCollapsible && storedCollapsed;

  const toggleCollapsed = useCallback(() => {
    setStoredCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // storage unavailable: keep the choice for this session only
      }
      return next;
    });
  }, []);

  // tokens.css reads --br-accent-custom on :root (light mode only), so it must be set on <html>.
  const accent = layout.accent;
  useLayoutEffect(() => {
    if (!accent) return;
    const el = document.documentElement;
    const previous = el.style.getPropertyValue(ACCENT_VAR);
    el.style.setProperty(ACCENT_VAR, accent);
    return () => {
      if (previous) el.style.setProperty(ACCENT_VAR, previous);
      else el.style.removeProperty(ACCENT_VAR);
    };
  }, [accent]);

  return (
    <div
      data-brume=""
      data-shell-mount={mountId}
      className="br-root br:flex br:min-h-screen br:bg-surface-canvas br:text-text"
    >
      <a
        href="#brume-main"
        className="br:sr-only br:focus:not-sr-only br:focus:fixed br:focus:top-2 br:focus:left-2 br:focus:z-50 br:focus:rounded-input br:focus:bg-surface br:focus:px-3 br:focus:py-2"
      >
        {t('shell.skipToContent')}
      </a>

      {sideMenu ? (
        <Sidebar
          appName={appName}
          items={menu}
          currentUrl={currentUrl}
          homeUrl={homeUrl}
          collapsible={layout.sidebarCollapsible}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      ) : null}

      <div className="br:flex br:min-w-0 br:flex-1 br:flex-col">
        <header className="br:sticky br:top-0 br:z-30 br:flex br:h-14 br:items-center br:gap-2 br:border-b br:border-border br:bg-surface br:px-4">
          <IconButton
            icon={Menu}
            label={t('shell.menu')}
            className="br:md:hidden"
            onClick={() => setDrawerOpen(true)}
          />
          {sideMenu ? null : (
            <>
              <span className="br:mr-2 br:truncate br:text-base br:font-semibold">{appName}</span>
              <TopMenu items={menu} currentUrl={currentUrl} homeUrl={homeUrl} />
            </>
          )}
          <div className="br:ml-auto br:flex br:items-center br:gap-1">
            <ColorSchemeMenu />
            {onLocaleChange ? <LocaleMenu onLocaleChange={onLocaleChange} /> : null}
            {user ? <UserMenu user={user} logoutUrl={logoutUrl} /> : null}
          </div>
        </header>

        <main id="brume-main" className="br:min-w-0 br:flex-1 br:px-4 br:py-6 br:md:px-8">
          {layout.breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
          {children}
        </main>
      </div>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'br:fixed br:inset-0 br:z-40 br:bg-scrim/40 br:md:hidden',
              OVERLAY_MOTION,
            )}
          />
          <Dialog.Content
            aria-describedby={undefined}
            data-brume=""
            className="br-root br:fixed br:inset-y-0 br:left-0 br:z-50 br:w-72 br:max-w-[85vw] br:overflow-y-auto br:bg-surface br:p-3 br:text-text br:shadow-overlay br:outline-none br:md:hidden br:data-[state=open]:animate-[br-drawer-in_var(--br-duration-slow)_var(--br-ease-emphasized)] br:data-[state=closed]:animate-[br-drawer-out_var(--br-duration-base)_var(--br-ease-emphasized)_forwards]"
          >
            <div className="br:mb-4 br:flex br:h-11 br:items-center br:justify-between br:px-3">
              <Dialog.Title className="br:truncate br:text-base br:font-semibold">
                {appName}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label={t('common.close')} />
              </Dialog.Close>
            </div>
            <SidebarNav
              items={menu}
              currentUrl={currentUrl}
              homeUrl={homeUrl}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
