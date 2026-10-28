import type { MenuItem } from '@brume-ui/brume-schema';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING, HIGHLIGHT_RING } from '../components/focus';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { containsItem, findCurrentItem, interceptClick, menuKey, resolveIcon } from './menu-utils';
import { MenuContent } from './navbar-menus';

const ITEM = `br:group br:inline-flex br:h-10 br:items-center br:gap-2 br:rounded-pill br:px-4 br:text-sm br:font-medium ${PRESS}`;
const IDLE = 'br:text-text br:hover:bg-surface-canvas';
const CURRENT = 'br:bg-accent-tint br:text-accent-tint-text';

/** Horizontal menu for layout.menuPosition = 'top'. Items with children open a dropdown. */
export function TopMenu({
  items,
  currentUrl,
  homeUrl,
}: {
  items: MenuItem[];
  currentUrl: string;
  homeUrl?: string;
}) {
  const { adapter, t } = useBrume();
  const currentItem = findCurrentItem(items, currentUrl, homeUrl);
  return (
    <nav aria-label={t('shell.mainNav')} className="br:max-md:hidden br:md:block">
      <ul className="br:flex br:items-center br:gap-1">
        {items.map((item) => {
          const Icon = resolveIcon(item.icon);
          const url = item.url ?? '#';
          const key = menuKey(item);
          if (item.children && item.children.length > 0) {
            const hasCurrent = containsItem(item, currentItem);
            return (
              <li key={key}>
                <Dropdown.Root>
                  <Dropdown.Trigger className={cn(ITEM, hasCurrent ? CURRENT : IDLE, FOCUS_RING)}>
                    <Icon aria-hidden="true" className="br:size-4" />
                    {item.title}
                    <ChevronDown
                      aria-hidden="true"
                      className="br:size-4 br:transition-[rotate] br:duration-base br:ease-out br:group-data-[state=open]:rotate-180"
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Portal>
                    <MenuContent align="start" sideOffset={6} className="br:min-w-44">
                      {item.children.map((child) => {
                        const childUrl = child.url ?? '#';
                        return (
                          <Dropdown.Item key={menuKey(child)} asChild>
                            <a
                              href={childUrl}
                              aria-current={child === currentItem ? 'page' : undefined}
                              onClick={interceptClick(() => adapter.visit(childUrl))}
                              className={cn(
                                'br:relative br:flex br:h-10 br:items-center br:rounded-input br:px-3 br:text-sm br:text-text',
                                HIGHLIGHT_RING,
                                child === currentItem && CURRENT,
                              )}
                            >
                              {child.title}
                            </a>
                          </Dropdown.Item>
                        );
                      })}
                    </MenuContent>
                  </Dropdown.Portal>
                </Dropdown.Root>
              </li>
            );
          }
          return (
            <li key={key}>
              <a
                href={url}
                aria-current={item === currentItem ? 'page' : undefined}
                onClick={interceptClick(() => adapter.visit(url))}
                className={cn(ITEM, item === currentItem ? CURRENT : IDLE, FOCUS_RING)}
              >
                <Icon aria-hidden="true" className="br:size-4" />
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
