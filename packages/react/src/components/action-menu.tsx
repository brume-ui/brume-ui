import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import type { ComponentType, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { cn } from '../cn';
import { MENU_ITEM, MenuContent } from '../layout/navbar-menus';
import { IconButton } from './icon-button';

export interface MenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** A single key (`E`), `Enter`, `Delete` or `Backspace`. Runs the item while the menu is open. */
  shortcut?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect(): void;
}

export interface ActionMenuProps {
  items: MenuAction[];
  /** aria-label of the trigger, e.g. 「{name} 的更多操作」. */
  label: string;
  /** Replaces the default 26px ⋯ IconButton. */
  trigger?: ReactElement;
}

/** Danger items go last, after one separator; everything else keeps its order. */
export function orderMenuItems(items: MenuAction[]): Array<MenuAction | 'separator'> {
  const safe = items.filter((i) => i.tone !== 'danger');
  const danger = items.filter((i) => i.tone === 'danger');
  if (safe.length === 0 || danger.length === 0) return [...safe, ...danger];
  return [...safe, 'separator', ...danger];
}

const ERASE = new Set(['delete', 'backspace']);

/** How a shortcut is shown in the menu: `Enter` → ↵, `Delete` / `Backspace` → ⌫. */
export function formatShortcut(shortcut: string): string {
  const s = shortcut.toLowerCase();
  if (s === 'enter') return '↵';
  if (ERASE.has(s)) return '⌫';
  return shortcut.length === 1 ? shortcut.toUpperCase() : shortcut;
}

function matchesShortcut(shortcut: string, key: string): boolean {
  const s = shortcut.toLowerCase();
  const k = key.toLowerCase();
  return ERASE.has(s) ? ERASE.has(k) : s === k;
}

/**
 * Content keydown handler: a key that matches an enabled item's shortcut clicks that item, so it
 * runs through Radix (onSelect, then close and focus back to the trigger). Enter and Space keep
 * activating the highlighted item, so an `Enter` shortcut is only a hint inside the menu.
 */
export function runShortcut(items: MenuAction[], event: KeyboardEvent<HTMLElement>): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Enter' || event.key === ' ') return;
  const item = items.find(
    (i) => !i.disabled && i.shortcut && matchesShortcut(i.shortcut, event.key),
  );
  if (!item) return;
  const el = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-menu-key]')).find(
    (node) => node.dataset.menuKey === item.key,
  );
  if (!el) return;
  // Also stops Radix typeahead from jumping to a label that starts with the same letter.
  event.preventDefault();
  el.click();
}

interface MenuParts {
  Item: ComponentType<{
    disabled?: boolean;
    onSelect?(event: Event): void;
    className?: string;
    children?: ReactNode;
    'aria-keyshortcuts'?: string;
    'data-menu-key'?: string;
  }>;
  Separator: ComponentType<{ className?: string }>;
}

/** The item list shared by ActionMenu and RowContextMenu (same order, look and shortcuts). */
export function MenuItems({ items, parts }: { items: MenuAction[]; parts: MenuParts }) {
  const { Item, Separator } = parts;
  return orderMenuItems(items).map((item, index) => {
    if (item === 'separator') {
      // biome-ignore lint/suspicious/noArrayIndexKey: there is at most one separator.
      return <Separator key={`sep-${index}`} className="br:mx-1 br:my-1 br:h-px br:bg-border" />;
    }
    const Icon = item.icon;
    return (
      <Item
        key={item.key}
        data-menu-key={item.key}
        disabled={item.disabled}
        aria-keyshortcuts={item.shortcut}
        onSelect={() => item.onSelect()}
        className={cn(
          MENU_ITEM,
          'br:pl-3 br:data-[disabled]:opacity-50',
          item.tone === 'danger' && 'br:text-danger',
        )}
      >
        {Icon ? <Icon aria-hidden="true" className="br:size-4 br:shrink-0" /> : null}
        <span className="br:min-w-0 br:flex-1 br:truncate">{item.label}</span>
        {item.shortcut ? (
          // The item carries aria-keyshortcuts; the glyph (↵, ⌫) is only a visual hint.
          <span aria-hidden="true" className="br:ml-4 br:text-xs br:text-text-muted">
            <kbd className="br:font-sans">{formatShortcut(item.shortcut)}</kbd>
          </span>
        ) : null}
      </Item>
    );
  });
}

const DROPDOWN_PARTS: MenuParts = { Item: Dropdown.Item, Separator: Dropdown.Separator };

/** Row actions behind a 26px ⋯ button (or a custom trigger); danger items last. */
export function ActionMenu({ items, label, trigger }: ActionMenuProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild aria-label={label}>
        {trigger ?? (
          <IconButton
            icon={MoreHorizontal}
            label={label}
            className="br:size-[26px] br:rounded-input br:text-text-muted br:hover:text-text br:data-[state=open]:bg-surface-selected br:data-[state=open]:text-text br:[&>svg]:size-4"
          />
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <MenuContent align="end" sideOffset={4} onKeyDown={(e) => runShortcut(items, e)}>
          <MenuItems items={items} parts={DROPDOWN_PARTS} />
        </MenuContent>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
