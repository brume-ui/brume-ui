import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import {
  type ComponentType,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useRef,
} from 'react';
import { cn } from '../cn';
import { MENU_CONTENT, MENU_ITEM } from '../layout/navbar-menus';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
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

/** Value for aria-keyshortcuts. Enter is left out: inside the menu it activates the highlight. */
function keyShortcuts(shortcut: string | undefined): string | undefined {
  if (!shortcut) return undefined;
  const s = shortcut.toLowerCase();
  if (s === 'enter') return undefined;
  if (ERASE.has(s)) return 'Delete Backspace';
  return shortcut.length === 1 ? shortcut.toUpperCase() : shortcut;
}

type ContentPart = ComponentType<{
  ref?: Ref<HTMLDivElement>;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  onKeyDown?(event: KeyboardEvent<HTMLDivElement>): void;
  onCloseAutoFocus?(event: Event): void;
  children?: ReactNode;
}>;

/** The Radix parts of one menu flavour (dropdown or context menu). */
export interface MenuParts {
  Content: ContentPart;
  Item: ComponentType<{
    disabled?: boolean;
    onSelect?(event: Event): void;
    className?: string;
    children?: ReactNode;
    'aria-keyshortcuts'?: string;
    'data-menu-key'?: string;
  }>;
  Separator: ComponentType<{ className?: string }>;
  /** Class that points --br-origin at this flavour's Radix transform-origin var. */
  origin: string;
}

function MenuItems({ items, parts }: { items: MenuAction[]; parts: MenuParts }) {
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
        aria-keyshortcuts={keyShortcuts(item.shortcut)}
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
          // The glyph (↵, ⌫) is only a visual hint; aria-keyshortcuts carries the keys.
          <span aria-hidden="true" className="br:ml-4 br:text-xs br:text-text-muted">
            <kbd className="br:font-sans">{formatShortcut(item.shortcut)}</kbd>
          </span>
        ) : null}
      </Item>
    );
  });
}

/**
 * The menu panel shared by ActionMenu and RowContextMenu: same look, origin-aware motion, gliding
 * highlight, item order and shortcuts. Only the Radix parts differ.
 */
export function ActionMenuContent({
  items,
  parts,
  align,
  sideOffset,
  onCloseAutoFocus,
}: {
  items: MenuAction[];
  parts: MenuParts;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  onCloseAutoFocus?(event: Event): void;
}) {
  const highlight = useHighlightIndicator();
  const { Content } = parts;
  return (
    <Content
      ref={highlight.ref}
      align={align}
      sideOffset={sideOffset}
      onCloseAutoFocus={onCloseAutoFocus}
      onKeyDown={(e) => runShortcut(items, e)}
      className={cn(MENU_CONTENT, parts.origin)}
    >
      <HighlightIndicator state={highlight} />
      <MenuItems items={items} parts={parts} />
    </Content>
  );
}

const DROPDOWN_PARTS: MenuParts = {
  Content: Dropdown.Content,
  Item: Dropdown.Item,
  Separator: Dropdown.Separator,
  origin: 'br:[--br-origin:var(--radix-dropdown-menu-content-transform-origin)]',
};

/** Row actions behind a 26px ⋯ button (or a custom trigger); danger items last. */
export function ActionMenu({ items, label, trigger }: ActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<(() => void) | null>(null);
  // An action may open a modal. Close the menu and focus its trigger before handing it over,
  // so that modal captures a connected external opener rather than a disappearing menu item.
  const deferred = items.map((item) => ({
    ...item,
    onSelect: () => {
      pending.current = item.onSelect;
    },
  }));
  return (
    <Dropdown.Root>
      <Dropdown.Trigger ref={triggerRef} asChild aria-label={label}>
        {trigger ?? (
          <IconButton
            icon={MoreHorizontal}
            label={label}
            className="br:size-[26px] br:rounded-input br:text-text-muted br:hover:text-text br:data-[state=open]:bg-surface-selected br:data-[state=open]:text-text br:[&>svg]:size-4"
          />
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <ActionMenuContent
          items={deferred}
          parts={DROPDOWN_PARTS}
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(event) => {
            const action = pending.current;
            pending.current = null;
            if (!action) return;
            event.preventDefault();
            triggerRef.current?.focus();
            action();
          }}
        />
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
