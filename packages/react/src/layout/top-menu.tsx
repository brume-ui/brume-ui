import type { MenuItem } from '@brume-ui/brume-schema';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { useBrume } from '../provider';
import { containsItem, findCurrentItem, interceptClick, menuKey, resolveIcon } from './menu-utils';

const ITEM =
  'br:inline-flex br:h-10 br:items-center br:gap-2 br:rounded-pill br:px-4 br:text-sm br:font-medium br:transition-colors br:motion-reduce:transition-none';
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
    <nav aria-label={t('shell.mainNav')} className="br:hidden br:md:block">
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
                    <ChevronDown aria-hidden="true" className="br:size-4" />
                  </Dropdown.Trigger>
                  <Dropdown.Portal>
                    <Dropdown.Content
                      align="start"
                      sideOffset={6}
                      className="br:z-50 br:min-w-44 br:rounded-card br:border br:border-border br:bg-surface br:p-1 br:shadow-overlay"
                    >
                      {item.children.map((child) => {
                        const childUrl = child.url ?? '#';
                        return (
                          <Dropdown.Item key={menuKey(child)} asChild>
                            <a
                              href={childUrl}
                              aria-current={child === currentItem ? 'page' : undefined}
                              onClick={interceptClick(() => adapter.visit(childUrl))}
                              className={cn(
                                'br:flex br:h-10 br:items-center br:rounded-input br:px-3 br:text-sm br:text-text br:outline-none br:data-[highlighted]:bg-surface-selected',
                                child === currentItem && CURRENT,
                              )}
                            >
                              {child.title}
                            </a>
                          </Dropdown.Item>
                        );
                      })}
                    </Dropdown.Content>
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
