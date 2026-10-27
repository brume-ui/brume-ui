import type { MenuItem } from '@herb09638/brume-schema';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { useBrume } from '../provider';
import { containsItem, findCurrentItem, interceptClick, menuKey, resolveIcon } from './menu-utils';

const ROW =
  'br:flex br:h-11 br:w-full br:items-center br:gap-3 br:rounded-card br:px-3 br:text-sm br:font-medium br:transition-colors br:motion-reduce:transition-none';
const IDLE = 'br:text-text br:hover:bg-surface-canvas';
const CURRENT = 'br:bg-accent-tint br:text-accent-tint-text';

interface NavProps {
  items: MenuItem[];
  currentUrl: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onExpandRequest?: () => void;
}

function CollapsedTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="br:z-50 br:rounded-input br:bg-text br:px-2 br:py-1 br:text-xs br:text-surface br:shadow-overlay"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NavLink({
  item,
  current,
  collapsed,
  nested,
  onNavigate,
}: {
  item: MenuItem;
  current: boolean;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const { adapter } = useBrume();
  const Icon = resolveIcon(item.icon);
  const url = item.url ?? '#';
  const link = (
    <a
      href={url}
      aria-current={current ? 'page' : undefined}
      aria-label={collapsed ? item.title : undefined}
      onClick={interceptClick(() => adapter.visit(url), onNavigate)}
      className={cn(
        ROW,
        current ? CURRENT : IDLE,
        collapsed && 'br:justify-center br:px-0',
        nested && 'br:pl-10',
        FOCUS_RING,
      )}
    >
      {nested ? null : <Icon aria-hidden="true" className="br:size-5 br:shrink-0" />}
      {collapsed ? null : <span className="br:truncate">{item.title}</span>}
    </a>
  );
  return collapsed ? <CollapsedTip label={item.title}>{link}</CollapsedTip> : link;
}

function NavGroup({
  item,
  currentItem,
  collapsed,
  onNavigate,
  onExpandRequest,
}: {
  item: MenuItem;
  currentItem: MenuItem | null;
  collapsed: boolean;
  onNavigate?: () => void;
  onExpandRequest?: () => void;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const hasCurrent = containsItem(item, currentItem);
  const open = override ?? hasCurrent;
  const Icon = resolveIcon(item.icon);

  if (collapsed) {
    // In icon-only mode a group can't show its children: clicking it re-expands the sidebar.
    return (
      <CollapsedTip label={item.title}>
        <button
          type="button"
          aria-label={item.title}
          onClick={onExpandRequest}
          className={cn(ROW, hasCurrent ? CURRENT : IDLE, 'br:justify-center br:px-0', FOCUS_RING)}
        >
          <Icon aria-hidden="true" className="br:size-5 br:shrink-0" />
        </button>
      </CollapsedTip>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOverride(!open)}
        className={cn(ROW, IDLE, hasCurrent && 'br:text-accent-tint-text', FOCUS_RING)}
      >
        <Icon aria-hidden="true" className="br:size-5 br:shrink-0" />
        <span className="br:flex-1 br:truncate br:text-left">{item.title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'br:size-4 br:shrink-0 br:transition-transform br:motion-reduce:transition-none',
            open && 'br:rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul className="br:mt-1 br:space-y-1">
          {(item.children ?? []).map((child) => (
            <li key={menuKey(child)}>
              <NavLink
                item={child}
                nested
                collapsed={false}
                current={child === currentItem}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The vertical menu list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  items,
  currentUrl,
  collapsed,
  onNavigate,
  onExpandRequest,
}: NavProps) {
  const { t } = useBrume();
  const currentItem = findCurrentItem(items, currentUrl);
  return (
    <Tooltip.Provider delayDuration={300}>
      <nav aria-label={t('shell.mainNav')}>
        <ul className="br:space-y-1">
          {items.map((item) => (
            <li key={menuKey(item)}>
              {item.children && item.children.length > 0 ? (
                <NavGroup
                  item={item}
                  currentItem={currentItem}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  onExpandRequest={onExpandRequest}
                />
              ) : (
                <NavLink
                  item={item}
                  current={item === currentItem}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </Tooltip.Provider>
  );
}

export interface SidebarProps {
  appName: string;
  items: MenuItem[];
  currentUrl: string;
  collapsible: boolean;
  collapsed: boolean;
  onToggleCollapsed(): void;
  mountId: string;
}

/** Desktop sidebar (hidden below md; the drawer takes over there). */
export function Sidebar({
  appName,
  items,
  currentUrl,
  collapsible,
  collapsed,
  onToggleCollapsed,
  mountId,
}: SidebarProps) {
  const { t } = useBrume();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? t('shell.expand') : t('shell.collapse');
  return (
    <aside
      data-shell-mount={mountId}
      data-collapsed={collapsed || undefined}
      className={cn(
        'br:sticky br:top-0 br:hidden br:h-screen br:shrink-0 br:flex-col br:border-r br:border-border br:bg-surface br:p-3 br:md:flex',
        collapsed ? 'br:w-[68px]' : 'br:w-60',
      )}
    >
      <div
        className={cn(
          'br:mb-4 br:flex br:h-11 br:items-center br:px-3 br:text-base br:font-semibold br:text-text',
          collapsed && 'br:justify-center br:px-0',
        )}
      >
        <span className="br:truncate" title={appName}>
          {collapsed ? appName.charAt(0).toUpperCase() : appName}
        </span>
      </div>
      <div className="br:min-h-0 br:flex-1 br:overflow-y-auto">
        <SidebarNav
          items={items}
          currentUrl={currentUrl}
          collapsed={collapsed}
          onExpandRequest={onToggleCollapsed}
        />
      </div>
      {collapsible ? (
        <button
          type="button"
          aria-label={toggleLabel}
          onClick={onToggleCollapsed}
          className={cn(
            ROW,
            IDLE,
            'br:mt-2 br:text-text-muted',
            collapsed && 'br:justify-center br:px-0',
            FOCUS_RING,
          )}
        >
          <ToggleIcon aria-hidden="true" className="br:size-5 br:shrink-0" />
          {collapsed ? null : <span>{toggleLabel}</span>}
        </button>
      ) : null}
    </aside>
  );
}
