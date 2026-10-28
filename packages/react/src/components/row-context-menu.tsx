import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  type CSSProperties,
  cloneElement,
  type PointerEvent,
  type ReactElement,
  type Ref,
  type SyntheticEvent,
  useRef,
} from 'react';
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

/** Elements whose own browser menu (paste, spell-check, open in new tab…) the row must not hide. */
const NATIVE_MENU_TARGETS =
  'a[href], input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function targetElement(event: SyntheticEvent): Element | null {
  const target = event.target as Node | null;
  if (!target) return null;
  return target instanceof Element ? target : target.parentElement;
}

/** Whether a non-empty text selection touches the event's target. */
function selectionCovers(event: SyntheticEvent): boolean {
  const selection = typeof window === 'undefined' ? null : window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  const target = event.target as Node | null;
  if (!target) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    if (selection.getRangeAt(i).intersectsNode(target)) return true;
  }
  return false;
}

/**
 * Whether this right-click / press should keep the browser's own menu: it came through a portal
 * (a dialog, popover or the ⋯ dropdown opened from the row; React events bubble through portals),
 * it is on a link or a text field, or it is on selected text.
 */
function keepsNativeMenu(event: SyntheticEvent, hadSelection: boolean): boolean {
  const target = event.target as Node | null;
  if (!target || !event.currentTarget.contains(target)) return true;
  if (targetElement(event)?.closest(NATIVE_MENU_TARGETS)) return true;
  return hadSelection;
}

type Handler<E> = ((event: E) => void) | undefined;

interface GuardedRowProps {
  children: ReactElement;
  ref?: Ref<Element>;
  style?: CSSProperties;
  onContextMenu?: Handler<SyntheticEvent>;
  onPointerDown?: Handler<PointerEvent>;
  [prop: string]: unknown;
}

/**
 * Sits between Radix's trigger and the row. Radix always prevents the native menu, so the row's
 * handlers are only passed on when the event is the row's own (see `keepsNativeMenu`).
 */
function GuardedRow({
  children,
  ref,
  style,
  onContextMenu,
  onPointerDown,
  ...rest
}: GuardedRowProps) {
  // The selection as it was when the press began: on some platforms the right press itself selects
  // the word under the pointer, which must not count.
  const selectionAtPress = useRef<boolean | null>(null);
  return cloneElement(children, {
    ...rest,
    ref,
    'data-br-row-menu': '',
    style: { ...style, ...(children.props as { style?: CSSProperties }).style },
    onPointerDownCapture: (event: PointerEvent) => {
      selectionAtPress.current = selectionCovers(event);
    },
    onPointerDown: (event: PointerEvent) => {
      if (keepsNativeMenu(event, selectionAtPress.current ?? false)) return;
      onPointerDown?.(event);
    },
    onContextMenu: (event: SyntheticEvent) => {
      const hadSelection = selectionAtPress.current ?? selectionCovers(event);
      selectionAtPress.current = null;
      if (keepsNativeMenu(event, hadSelection)) return;
      onContextMenu?.(event);
    },
  } as Record<string, unknown>);
}

/**
 * Right-click menu with the same items as the row's ActionMenu. The ⋯ ActionMenu is the keyboard
 * route to these actions, so this one only has to serve the pointer. Links, text fields, selected
 * text and anything portaled out of the row keep the browser's own menu.
 */
export function RowContextMenu({ items, children }: RowContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <GuardedRow>{children}</GuardedRow>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ActionMenuContent items={items} parts={CONTEXT_PARTS} />
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
