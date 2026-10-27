import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../cn';
import { type ColorScheme, useColorScheme } from '../color-scheme';
import { FOCUS_RING } from '../components/focus';
import type { Locale } from '../i18n';
import { useBrume } from '../provider';

export const MENU_CONTENT =
  'br:z-50 br:min-w-40 br:rounded-card br:border br:border-border br:bg-surface br:p-1 br:shadow-overlay';
export const MENU_ITEM =
  'br:relative br:flex br:h-10 br:cursor-default br:items-center br:gap-2 br:rounded-input br:pr-3 br:pl-8 br:text-sm br:text-text br:outline-none br:select-none br:data-[highlighted]:bg-surface-selected';
export const TRIGGER =
  'br:inline-flex br:size-10 br:items-center br:justify-center br:rounded-pill br:text-text br:transition-colors br:hover:bg-surface-canvas br:motion-reduce:transition-none';

interface RadioOption {
  value: string;
  label: string;
}

function RadioMenu({
  label,
  icon,
  value,
  options,
  onValueChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: RadioOption[];
  onValueChange(value: string): void;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger aria-label={label} title={label} className={cn(TRIGGER, FOCUS_RING)}>
        {icon}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className={MENU_CONTENT}>
          <Dropdown.RadioGroup value={value} onValueChange={onValueChange} aria-label={label}>
            {options.map((o) => (
              <Dropdown.RadioItem key={o.value} value={o.value} className={MENU_ITEM}>
                <Dropdown.ItemIndicator className="br:absolute br:left-2">
                  <Check aria-hidden="true" className="br:size-4" />
                </Dropdown.ItemIndicator>
                {o.label}
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function ColorSchemeMenu() {
  const { t } = useBrume();
  const { scheme, setScheme } = useColorScheme();
  const Icon = scheme === 'dark' ? Moon : scheme === 'light' ? Sun : Monitor;
  return (
    <RadioMenu
      label={t('shell.colorScheme')}
      icon={<Icon aria-hidden="true" className="br:size-5" />}
      value={scheme}
      onValueChange={(v) => setScheme(v as ColorScheme)}
      options={[
        { value: 'light', label: t('shell.scheme.light') },
        { value: 'dark', label: t('shell.scheme.dark') },
        { value: 'system', label: t('shell.scheme.system') },
      ]}
    />
  );
}

const LOCALES: RadioOption[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
];

export function LocaleMenu({ onLocaleChange }: { onLocaleChange(locale: Locale): void }) {
  const { t, locale } = useBrume();
  return (
    <RadioMenu
      label={t('shell.language')}
      icon={<Globe aria-hidden="true" className="br:size-5" />}
      value={locale}
      onValueChange={(v) => onLocaleChange(v as Locale)}
      options={LOCALES}
    />
  );
}
