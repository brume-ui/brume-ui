import * as ContextMenu from '@radix-ui/react-context-menu';
import type { ReactElement } from 'react';
import { ActionMenuContent, type MenuAction, type MenuParts } from './action-menu';

export interface RowContextMenuProps {
  items: MenuAction[];
  /** The whole row; right-clicking anywhere on it opens the menu. */
  children: ReactElement;
}

const CONTEXT_PARTS: MenuParts = {
  Content: ContextMenu.Content,
  Item: ContextMenu.Item,
  Separator: ContextMenu.Separator,
  origin: 'br:[--br-origin:var(--radix-context-menu-content-transform-origin)]',
};

/**
 * Right-click menu with the same items as the row's ActionMenu. The ⋯ ActionMenu is the keyboard
 * route to these actions, so this one only has to serve the pointer.
 */
export function RowContextMenu({ items, children }: RowContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ActionMenuContent items={items} parts={CONTEXT_PARTS} />
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
