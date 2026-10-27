import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { LogOut } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { useBrume } from '../provider';
import { MENU_CONTENT, MENU_ITEM } from './navbar-menus';

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
          'br:inline-flex br:h-10 br:items-center br:gap-2 br:rounded-pill br:pr-3 br:pl-1 br:text-sm br:text-text br:transition-colors br:hover:bg-surface-canvas br:motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="br:size-8 br:rounded-pill br:object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="br:flex br:size-8 br:items-center br:justify-center br:rounded-pill br:bg-surface-selected br:text-sm br:font-semibold"
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="br:hidden br:max-w-32 br:truncate br:sm:inline">{user.name}</span>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className={MENU_CONTENT}>
          <Dropdown.Item
            className={MENU_ITEM}
            onSelect={() => adapter.submit('post', logoutUrl, {})}
          >
            <LogOut aria-hidden="true" className="br:absolute br:left-2 br:size-4" />
            {t('shell.logout')}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
