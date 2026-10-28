import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { LogOut } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { MENU_ITEM, MenuContent } from './navbar-menus';

export interface ShellUser {
  name: string;
  avatar?: string | null;
}

export function UserMenu({ user, logoutUrl }: { user: ShellUser; logoutUrl: string }) {
  const { adapter, t } = useBrume();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        aria-label={`${t('shell.userMenu')}: ${user.name}`}
        className={cn(
          'br:inline-flex br:h-10 br:items-center br:gap-2 br:rounded-pill br:pr-3 br:pl-1 br:text-sm br:text-text br:hover:bg-surface-canvas',
          PRESS,
          FOCUS_RING,
        )}
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="br:size-8 br:rounded-pill br:object-cover" />
        ) : (
          // The initial is CSS-generated so it is not "visible text" that the accessible name
          // has to contain (WCAG 2.5.3, axe label-content-name-mismatch).
          <span
            aria-hidden="true"
            data-initial={user.name.charAt(0).toUpperCase()}
            className="br:flex br:size-8 br:items-center br:justify-center br:rounded-pill br:bg-surface-selected br:text-sm br:font-semibold br:before:content-[attr(data-initial)]"
          />
        )}
        <span className="br:max-sm:hidden br:max-w-32 br:truncate br:sm:inline">{user.name}</span>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <MenuContent align="end" sideOffset={6}>
          <Dropdown.Item
            className={MENU_ITEM}
            onSelect={() => adapter.submit('post', logoutUrl, {})}
          >
            <LogOut aria-hidden="true" className="br:absolute br:left-2 br:size-4" />
            {t('shell.logout')}
          </Dropdown.Item>
        </MenuContent>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
