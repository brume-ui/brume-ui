import type { MenuItem } from '@brume-ui/brume-schema';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { PRESS } from '../motion/classes';
import { useActiveIndicator } from '../motion/indicator';
import { usePresence } from '../motion/presence';
import { useBrume } from '../provider';
import { containsItem, findCurrentItem, interceptClick, menuKey, resolveIcon } from './menu-utils';

const ROW_BASE = `br:relative br:flex br:h-11 br:w-full br:items-center br:gap-3 br:rounded-card br:text-sm br:font-medium ${PRESS}`;
const ROW = `${ROW_BASE} br:px-3`;
/**
 * Child links line their label up with the group label (12px padding + 20px icon + 12px gap).
 * Own padding, not `pl-*` on top of `px-3`: those are different properties, and with several
 * Brume stylesheets on a page the later `px-3` can win the cascade.
 */
const NESTED_ROW = `${ROW_BASE} br:pr-3 br:pl-11`;
const IDLE = 'br:text-text br:hover:bg-surface-canvas';
/** Current text; the tint comes from the sliding indicator once it is placed. */
const CURRENT_TEXT = 'br:text-accent-tint-text';
const CURRENT_BG = 'br:bg-accent-tint';
/** Height transition of a group's children (matches --br-duration-base). */
const SUBMENU_MS = 200;
/** Marks the element showing "current" so the indicator can find it. */
const CURRENT_ATTR = 'data-nav-current';

function currentClass(indicatorReady: boolean): string {
  return cn(CURRENT_TEXT, !indicatorReady && CURRENT_BG);
}

/** Labels fade in when the sidebar widens back out. */
const LABEL = 'br:truncate br:animate-[br-fade-in_var(--br-duration-base)_var(--br-ease-out)]';

interface NavProps {
  items: MenuItem[];
  currentUrl: string;
  homeUrl?: string;
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
  indicatorReady,
}: {
  item: MenuItem;
  current: boolean;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
  indicatorReady: boolean;
}) {
  const { adapter } = useBrume();
  const Icon = resolveIcon(item.icon);
  const url = item.url ?? '#';
  const link = (
    <a
      href={url}
      aria-current={current ? 'page' : undefined}
      {...{ [CURRENT_ATTR]: current ? '' : undefined }}
      aria-label={collapsed ? item.title : undefined}
      onClick={interceptClick(() => adapter.visit(url), onNavigate)}
      className={cn(
        nested ? NESTED_ROW : ROW,
        current ? currentClass(indicatorReady) : IDLE,
        collapsed && 'br:justify-center br:px-0',
        FOCUS_RING,
      )}
    >
      {nested ? null : <Icon aria-hidden="true" className="br:size-5 br:shrink-0" />}
      {collapsed ? null : <span className={LABEL}>{item.title}</span>}
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
  indicatorReady,
}: {
  item: MenuItem;
  currentItem: MenuItem | null;
  collapsed: boolean;
  onNavigate?: () => void;
  onExpandRequest?: () => void;
  indicatorReady: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const hasCurrent = containsItem(item, currentItem);
  const open = override ?? hasCurrent;
  const children = usePresence(open && !collapsed, SUBMENU_MS);
  const Icon = resolveIcon(item.icon);

  if (collapsed) {
    // In icon-only mode a group can't show its children: clicking it re-expands the sidebar.
    return (
      <CollapsedTip label={item.title}>
        <button
          type="button"
          aria-label={item.title}
          {...{ [CURRENT_ATTR]: hasCurrent ? '' : undefined }}
          onClick={onExpandRequest}
          className={cn(
            ROW,
            hasCurrent ? currentClass(indicatorReady) : IDLE,
            'br:justify-center br:px-0',
            FOCUS_RING,
          )}
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
        // A closed group stands in for its current child, so the indicator moves onto it.
        {...{ [CURRENT_ATTR]: hasCurrent && !open ? '' : undefined }}
        onClick={() => setOverride(!open)}
        className={cn(
          ROW,
          hasCurrent && !open ? currentClass(indicatorReady) : IDLE,
          hasCurrent && CURRENT_TEXT,
          FOCUS_RING,
        )}
      >
        <Icon aria-hidden="true" className="br:size-5 br:shrink-0" />
        <span className={cn(LABEL, 'br:flex-1 br:text-left')}>{item.title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'br:size-4 br:shrink-0 br:transition-[rotate] br:duration-base br:ease-emphasized',
            open && 'br:rotate-180',
          )}
        />
      </button>
      {children.mounted ? (
        // grid-template-rows 0fr -> 1fr animates to the content's own height.
        <div
          // Leaving children are out of the tab order and the a11y tree while they collapse.
          inert={!children.shown || undefined}
          className={cn(
            'br:grid br:transition-[grid-template-rows,opacity] br:duration-base br:ease-emphasized',
            children.shown
              ? 'br:grid-rows-[1fr] br:opacity-100'
              : 'br:grid-rows-[0fr] br:opacity-0',
          )}
        >
          {/* Clip only while moving, so settled focus rings are not cut off. */}
          <ul className={cn('br:min-h-0 br:space-y-1', !children.settled && 'br:overflow-hidden')}>
            {(item.children ?? []).map((child) => (
              <li key={menuKey(child)} className="br:first:mt-1">
                <NavLink
                  item={child}
                  nested
                  collapsed={false}
                  current={child === currentItem}
                  onNavigate={onNavigate}
                  indicatorReady={indicatorReady}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The vertical menu list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  items,
  currentUrl,
  homeUrl,
  collapsed,
  onNavigate,
  onExpandRequest,
}: NavProps) {
  const { t } = useBrume();
  const currentItem = findCurrentItem(items, currentUrl, homeUrl);
  const navRef = useRef<HTMLElement>(null);
  const indicator = useActiveIndicator(
    navRef,
    `[${CURRENT_ATTR}]`,
    `${currentUrl}|${collapsed ? 1 : 0}`,
  );
  return (
    <Tooltip.Provider delayDuration={300}>
      <nav ref={navRef} aria-label={t('shell.mainNav')} className="br:relative">
        {/* The current-item tint, sliding between items as the page changes. */}
        <div
          aria-hidden="true"
          style={indicator.style}
          className="br:pointer-events-none br:absolute br:top-0 br:left-0 br:rounded-card br:bg-accent-tint br:transition-[transform,width,height,opacity] br:duration-slow br:ease-emphasized br:motion-reduce:transition-none"
        />
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
                  indicatorReady={indicator.ready}
                />
              ) : (
                <NavLink
                  item={item}
                  current={item === currentItem}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  indicatorReady={indicator.ready}
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
  homeUrl?: string;
  collapsible: boolean;
  collapsed: boolean;
  onToggleCollapsed(): void;
}

/** Desktop sidebar (hidden below md; the drawer takes over there). */
export function Sidebar({
  appName,
  items,
  currentUrl,
  homeUrl,
  collapsible,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const { t } = useBrume();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? t('shell.expand') : t('shell.collapse');
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        'br:sticky br:top-0 br:hidden br:h-screen br:shrink-0 br:flex-col br:border-r br:border-border br:bg-surface br:p-3 br:md:flex',
        'br:transition-[width] br:duration-slow br:ease-emphasized',
        collapsed ? 'br:w-[68px]' : 'br:w-60',
      )}
    >
      <div
        className={cn(
          'br:mb-4 br:flex br:h-11 br:items-center br:px-3 br:text-base br:font-semibold br:text-text',
          collapsed && 'br:justify-center br:px-0',
        )}
      >
        <span key={collapsed ? 'short' : 'full'} className={LABEL} title={appName}>
          {collapsed ? appName.charAt(0).toUpperCase() : appName}
        </span>
      </div>
      <div className="br:min-h-0 br:flex-1 br:overflow-y-auto">
        <SidebarNav
          items={items}
          currentUrl={currentUrl}
          homeUrl={homeUrl}
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
          {collapsed ? null : <span className={LABEL}>{toggleLabel}</span>}
        </button>
      ) : null}
    </aside>
  );
}
