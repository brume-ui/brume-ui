import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, Globe, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { type ColorScheme, useColorScheme } from '../color-scheme';
import { FOCUS_RING, HIGHLIGHT_RING } from '../components/focus';
import type { Locale } from '../i18n';
import { POPOVER_MOTION, PRESS } from '../motion/classes';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
import { useBrume } from '../provider';

export const MENU_CONTENT = `br:relative br:z-50 br:min-w-40 br:rounded-card br:border br:border-border br:bg-surface br:p-1 br:shadow-overlay br:[--br-origin:var(--radix-dropdown-menu-content-transform-origin)] ${POPOVER_MOTION}`;
/** Item background comes from the gliding HighlightIndicator inside MenuContent. */
export const MENU_ITEM = `br:relative br:flex br:h-10 br:cursor-default br:items-center br:gap-2 br:rounded-input br:pr-3 br:pl-8 br:text-sm br:text-text br:select-none ${HIGHLIGHT_RING}`;
export const TRIGGER = `br:inline-flex br:size-10 br:items-center br:justify-center br:rounded-pill br:text-text br:hover:bg-surface-canvas ${PRESS}`;

/** Dropdown.Content with the shared look, origin-aware open/close and a gliding highlight. */
export function MenuContent({
  className,
  children,
  ...rest
}: ComponentProps<typeof Dropdown.Content>) {
  const highlight = useHighlightIndicator();
  return (
    <Dropdown.Content ref={highlight.ref} {...rest} className={cn(MENU_CONTENT, className)}>
      <HighlightIndicator state={highlight} />
      {children}
    </Dropdown.Content>
  );
}

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
        <MenuContent align="end" sideOffset={6}>
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
        </MenuContent>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

const SCHEME_ICONS: Array<[ColorScheme, LucideIcon]> = [
  ['light', Sun],
  ['dark', Moon],
  ['system', Monitor],
];

/** All three icons stay mounted and cross-fade with a small turn (blur hides the overlap). */
function SchemeIcon({ scheme }: { scheme: ColorScheme }) {
  return (
    <span aria-hidden="true" className="br:relative br:block br:size-5">
      {SCHEME_ICONS.map(([value, Icon]) => (
        <Icon
          key={value}
          data-active={value === scheme || undefined}
          className="br:absolute br:inset-0 br:size-5 br:scale-50 br:-rotate-90 br:opacity-0 br:blur-[2px] br:transition-[opacity,scale,rotate,filter] br:duration-slow br:ease-out br:motion-reduce:transition-[opacity] br:motion-reduce:duration-fade br:data-active:scale-100 br:data-active:rotate-0 br:data-active:opacity-100 br:data-active:blur-none"
        />
      ))}
    </span>
  );
}

export function ColorSchemeMenu() {
  const { t } = useBrume();
  const { scheme, setScheme } = useColorScheme();
  return (
    <RadioMenu
      label={t('shell.colorScheme')}
      icon={<SchemeIcon scheme={scheme} />}
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
