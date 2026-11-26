import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

export interface CaptchaInputProps extends FieldControlProps {
  value: string;
  onChange(value: string): void;
  onBlur?(): void;
  /** Image URL; `r=<counter>` is added (it may already carry a query string or a hash). */
  src: string;
  /** Change it to load a fresh image (e.g. after a failed submit). */
  refreshKey: number;
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name of the text box. */
  label: string;
}

/** `src` with its `r` parameter set to `counter`, before any `#hash`. */
function withCounter(src: string, counter: number): string {
  const hashAt = src.indexOf('#');
  const hash = hashAt === -1 ? '' : src.slice(hashAt);
  const base = hashAt === -1 ? src : src.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const path = queryAt === -1 ? base : base.slice(0, queryAt);
  const kept = (queryAt === -1 ? '' : base.slice(queryAt + 1))
    .split('&')
    .filter((part) => part !== '' && part.split('=')[0] !== 'r');
  return `${path}?${[...kept, `r=${counter}`].join('&')}${hash}`;
}

/** Verification image with an answer box and a refresh button. Refreshing never touches the typed text. */
export function CaptchaInput({
  value,
  onChange,
  onBlur,
  src,
  refreshKey,
  placeholder,
  disabled,
  label,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: CaptchaInputProps) {
  const { t } = useBrume();
  const [counter, setCounter] = useState(0);
  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (lastKey.current !== refreshKey) {
      lastKey.current = refreshKey;
      setCounter((n) => n + 1);
    }
  }, [refreshKey]);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);

  return (
    <div className="br:flex br:w-full br:items-center br:gap-2">
      <img
        src={withCounter(src, counter)}
        alt={t('captcha.image')}
        width={120}
        height={36}
        draggable={false}
        className="br:h-9 br:w-[120px] br:shrink-0 br:object-contain br:rounded-input br:border br:border-border-strong br:bg-surface"
      />
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        aria-required={ariaOn(ariaRequired) || undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        className={cn(
          CONTROL_BASE,
          'br:min-w-0 br:flex-1',
          isInvalid ? 'br:border-danger' : CONTROL_BORDER,
          FOCUS_RING,
        )}
      />
      <IconButton
        icon={RefreshCw}
        label={t('captcha.refresh')}
        disabled={disabled}
        onClick={() => setCounter((n) => n + 1)}
      />
    </div>
  );
}
