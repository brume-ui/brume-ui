import { useEffect, useState } from 'react';
import { HexAlphaColorPicker, HexColorPicker } from 'react-colorful';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { normalizeHex } from './color';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { Popover } from './popover';

export interface ColorInputProps extends FieldControlProps {
  /** Canonical `#rrggbb` (`#rrggbbaa` with `alpha`), or whatever was typed while it is invalid. */
  value: string | null;
  onChange(value: string | null): void;
  onBlur?(): void;
  /** Adds an opacity slider and accepts 4 / 8 digit hex. */
  alpha?: boolean;
  /** Preset colours offered under the picker. */
  swatches?: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name of the field; also names the picker button and its panel. */
  label: string;
}

/** A checkerboard so that a translucent colour reads as translucent. */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    'conic-gradient(var(--br-border) 25%, transparent 0 50%, var(--br-border) 0 75%, transparent 0)',
  backgroundSize: '8px 8px',
};

/** The empty state: a diagonal slash on the surface colour. */
const EMPTY: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(to top right, transparent calc(50% - 1px), var(--br-danger) 50%, transparent calc(50% + 1px))',
};

/**
 * A read-only colour swatch (decorative: the hex text next to it carries the meaning). Anything
 * that is not a valid hex, including non-strings from corrupt data, shows the empty slash.
 */
export function ColorChip({ value }: { value: unknown }) {
  const hex = typeof value === 'string' ? normalizeHex(value, true) : null;
  return (
    <span
      aria-hidden="true"
      className="br:mr-2 br:inline-block br:size-5 br:shrink-0 br:overflow-hidden br:rounded-input br:border br:border-border-strong"
      style={hex ? CHECKERBOARD : EMPTY}
    >
      {hex ? <span className="br:block br:size-full" style={{ backgroundColor: hex }} /> : null}
    </span>
  );
}

/**
 * Hex colour field: a text input with a colour chip that opens a picker (react-colorful) and
 * optional swatches. Typing reports the raw text so validation can speak about it; blur replaces a
 * valid value by its canonical form and an empty box by null.
 */
export function ColorInput({
  value,
  onChange,
  onBlur,
  alpha = false,
  swatches,
  placeholder,
  disabled,
  label,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: ColorInputProps) {
  const { t } = useBrume();
  const [open, setOpen] = useState(false);
  // A disabled field never keeps a panel open, and re-enabling must not bring it back.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const text = value ?? '';
  const current = normalizeHex(text, alpha);
  const Picker = alpha ? HexAlphaColorPicker : HexColorPicker;
  const presets = [
    ...new Set(
      (swatches ?? []).map((s) => normalizeHex(s, alpha)).filter((s): s is string => s !== null),
    ),
  ];

  const emit = (hex: string) => onChange(normalizeHex(hex, alpha) ?? hex);

  const chip = (
    <button
      type="button"
      disabled={disabled}
      aria-label={t('color.open', { label })}
      className={cn(
        'br:absolute br:top-1/2 br:left-2 br:size-6 br:-translate-y-1/2 br:overflow-hidden br:rounded-input br:border br:border-border-strong br:bg-surface br:p-0 br:disabled:cursor-not-allowed',
        FOCUS_RING,
      )}
      style={current ? CHECKERBOARD : EMPTY}
    >
      {current ? (
        <span className="br:block br:size-full" style={{ backgroundColor: current }} />
      ) : null}
    </button>
  );

  return (
    <div className="br:relative br:w-full">
      <input
        id={id}
        type="text"
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? (alpha ? '#rrggbbaa' : '#rrggbb')}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        aria-required={ariaOn(ariaRequired) || undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (text.trim() === '') {
            if (value !== null) onChange(null);
          } else if (current && current !== value) {
            onChange(current);
          }
          onBlur?.();
        }}
        className={cn(
          CONTROL_BASE,
          'br:w-full br:pl-11 br:font-mono',
          isInvalid ? 'br:border-danger' : CONTROL_BORDER,
          FOCUS_RING,
        )}
      />
      <Popover trigger={chip} title={label} open={open && !disabled} onOpenChange={setOpen}>
        <div className="br-color-picker">
          {/* react-colorful 5.6.1 hard-codes English aria-labels ("Hue", "Color", "Alpha") on its sliders; known limit. */}
          <Picker color={current ?? (alpha ? '#000000ff' : '#000000')} onChange={emit} />
        </div>
        {presets.length > 0 ? (
          <fieldset
            aria-label={t('color.swatches')}
            className="br:m-0 br:mt-3 br:flex br:min-w-0 br:flex-wrap br:gap-2 br:border-0 br:p-0"
          >
            {presets.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                aria-pressed={hex === current}
                onClick={() => onChange(hex)}
                className={cn(
                  'br:size-6 br:overflow-hidden br:rounded-input br:border br:border-border-strong br:p-0 br:aria-pressed:ring-2 br:aria-pressed:ring-focus-ring br:aria-pressed:ring-offset-1',
                  FOCUS_RING,
                )}
                style={CHECKERBOARD}
              >
                <span className="br:block br:size-full" style={{ backgroundColor: hex }} />
              </button>
            ))}
          </fieldset>
        ) : null}
      </Popover>
    </div>
  );
}
