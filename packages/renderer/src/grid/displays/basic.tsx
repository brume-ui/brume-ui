import {
  Badge,
  IconButton,
  Link,
  Popover,
  ProgressBar,
  toast,
  useBrume,
} from '@brume-ui/brume-react';
import type { Display, ListColumn } from '@brume-ui/brume-schema';
import { Copy, Ellipsis } from 'lucide-react';
import { formatCell } from './format';

type DisplayOf<K extends Display['type']> = Extract<Display, { type: K }>;

interface Props<K extends Display['type']> {
  column: ListColumn;
  display: DisplayOf<K>;
  value: unknown;
}

/**
 * One pill per value: the option's label and tone. With options, a value outside them shows as is
 * in the neutral tone; without options every value takes the column's tone.
 */
export function LabelDisplay({ display, value }: Props<'label'>) {
  const values = (Array.isArray(value) ? value : [value]).filter(
    (v) => v !== null && v !== undefined && v !== '',
  );
  if (values.length === 0) return null;
  return (
    <span className="br:inline-flex br:max-w-full br:items-center br:gap-1">
      {values.map((v, i) => {
        const key = formatCell(v);
        const option = display.options?.[key];
        const tone = option?.tone ?? (display.options ? 'neutral' : (display.tone ?? 'neutral'));
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: values can repeat
          <Badge key={i} tone={tone}>
            {option?.label ?? key}
          </Badge>
        );
      })}
    </span>
  );
}

export function BadgeDisplay({ display, value }: Props<'badge'>) {
  const text = formatCell(value);
  if (text === '') return null;
  return (
    <Badge tone={display.tone ?? 'neutral'} count>
      {text}
    </Badge>
  );
}

export function LinkDisplay({
  display,
  value,
  href,
}: Props<'link'> & { href: string | undefined }) {
  const text = formatCell(value);
  if (!href) return text;
  return (
    <Link
      href={href}
      external={display.external}
      variant={display.style === 'button' ? 'button' : 'text'}
    >
      {text || href}
    </Link>
  );
}

/** The first `length` characters and a 「…」 button that shows the whole text in a popover. */
export function LimitDisplay({ column, display, value }: Props<'limit'>) {
  const { t } = useBrume();
  const text = formatCell(value);
  const chars = Array.from(text);
  if (chars.length <= display.length) return text;
  return (
    <span className="br:inline-flex br:max-w-full br:items-center br:gap-1">
      <span className="br:truncate">{chars.slice(0, display.length).join('')}</span>
      <Popover
        title={column.label}
        trigger={
          <IconButton
            icon={Ellipsis}
            size="sm"
            label={t('grid.display.showFull', { label: column.label })}
          />
        }
      >
        <p className="br:break-words br:whitespace-pre-wrap">{text}</p>
      </Popover>
    </span>
  );
}

export function ProgressDisplay({ column, display, value }: Props<'progress'>) {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) {
    return formatCell(value);
  }
  return <ProgressBar value={n} max={display.max} label={column.label} />;
}

export function CopyableDisplay({ column, value }: Props<'copyable'>) {
  const { t } = useBrume();
  const text = formatCell(value);
  if (text === '') return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('common.copied'), { id: 'grid-copied' });
    } catch {
      toast.error(t('grid.display.copyFailed'), { id: 'grid-copy-failed' });
    }
  }
  return (
    <span className="br:inline-flex br:max-w-full br:items-center br:gap-1">
      <span className="br:truncate">{text}</span>
      <IconButton
        icon={Copy}
        size="sm"
        label={t('grid.display.copy', { label: column.label })}
        onClick={copy}
      />
    </span>
  );
}
