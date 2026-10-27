import { type ColorScheme, type Locale, useColorScheme } from '@brume-ui/brume-react';
import { ACCENT_PRESETS, type MenuPosition, useSettings } from './settings';

const SCHEMES: Array<{ value: ColorScheme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];
const LOCALES: Locale[] = ['zh-TW', 'en', 'zh-CN'];
const POSITIONS: MenuPosition[] = ['side', 'top'];

function Segmented<T extends string>(props: {
  legend: string;
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange(value: T): void;
}) {
  return (
    <fieldset className="pg-group">
      <legend>{props.legend}</legend>
      {props.options.map((o) => (
        <label key={o.value} className="pg-chip" data-active={o.value === props.value}>
          <input
            type="radio"
            name={props.name}
            value={o.value}
            checked={o.value === props.value}
            onChange={() => props.onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function SwitcherBar({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange(locale: Locale): void;
}) {
  const { scheme, setScheme } = useColorScheme();
  const { accent, setAccent, menuPosition, setMenuPosition } = useSettings();
  return (
    <aside className="pg-bar" data-testid="pg-switcher" aria-label="Playground settings">
      {/* href="./" (not "#/"): axe treats "#/" links as page links, and one placed before
          AppShell's skip link stops axe recognising that skip link (region rule). */}
      <a
        href="./"
        className="pg-bar-title"
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = '/';
        }}
      >
        Brume Playground
      </a>
      <Segmented
        legend="Scheme"
        name="pg-scheme"
        options={SCHEMES}
        value={scheme}
        onChange={setScheme}
      />
      <Segmented
        legend="Locale"
        name="pg-locale"
        options={LOCALES.map((l) => ({ value: l, label: l }))}
        value={locale}
        onChange={onLocaleChange}
      />
      <fieldset className="pg-group">
        <legend>Accent (light only)</legend>
        {ACCENT_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className="pg-swatch"
            style={{ background: c }}
            aria-label={`Accent ${c}`}
            aria-pressed={c === accent}
            onClick={() => setAccent(c)}
          />
        ))}
        <input
          type="color"
          aria-label="Custom accent"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
        />
      </fieldset>
      <Segmented
        legend="Menu position"
        name="pg-menu"
        options={POSITIONS.map((p) => ({ value: p, label: p }))}
        value={menuPosition}
        onChange={setMenuPosition}
      />
    </aside>
  );
}
