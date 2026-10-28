import * as ContextMenu from '@radix-ui/react-context-menu';
import type { ReactElement } from 'react';
import { cn } from '../cn';
import { MENU_CONTENT } from '../layout/navbar-menus';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
import { type MenuAction, MenuItems, runShortcut } from './action-menu';

export interface RowContextMenuProps {
  items: MenuAction[];
  /** The whole row; right-clicking anywhere on it opens the menu. */
  children: ReactElement;
}

const CONTEXT_PARTS = { Item: ContextMenu.Item, Separator: ContextMenu.Separator };

/**
 * Right-click menu with the same items as the row's ActionMenu. The ⋯ ActionMenu is the keyboard
 * route to these actions, so this one only has to serve the pointer.
 */
export function RowContextMenu({ items, children }: RowContextMenuProps) {
  const highlight = useHighlightIndicator();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          ref={highlight.ref}
          onKeyDown={(e) => runShortcut(items, e)}
          className={cn(
            MENU_CONTENT,
            'br:[--br-origin:var(--radix-context-menu-content-transform-origin)]',
          )}
        >
          <HighlightIndicator state={highlight} />
          <MenuItems items={items} parts={CONTEXT_PARTS} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
