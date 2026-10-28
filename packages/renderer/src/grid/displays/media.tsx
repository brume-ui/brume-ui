import {
  Badge,
  Dialog,
  IconButton,
  Link,
  Popover,
  QrCode,
  Thumbnail,
  useBrume,
} from '@brume-ui/brume-react';
import type { Display, ListColumn } from '@brume-ui/brume-schema';
import { Download, QrCode as QrCodeIcon } from 'lucide-react';
import { useState } from 'react';
import { formatCell } from './format';

type DisplayOf<K extends Display['type']> = Extract<Display, { type: K }>;

interface Props<K extends Display['type']> {
  column: ListColumn;
  display: DisplayOf<K>;
  value: unknown;
}

const MAX_THUMBNAILS = 3;

function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (v): v is string => typeof v === 'string' && v !== '',
  );
}

/** Up to three thumbnails (then 「+N」); a click shows that image large in a dialog. */
export function ImageDisplay({ column, display, value }: Props<'image'>) {
  const { t } = useBrume();
  const [open, setOpen] = useState<string | null>(null);
  const urls = strings(value);
  if (urls.length === 0) return null;
  const rest = urls.length - MAX_THUMBNAILS;
  return (
    <span className="br:inline-flex br:items-center br:gap-1">
      {urls.slice(0, MAX_THUMBNAILS).map((url, i) => (
        <Thumbnail
          // biome-ignore lint/suspicious/noArrayIndexKey: the same image can repeat
          key={i}
          src={url}
          alt={column.label}
          label={t('grid.display.viewImage', { label: column.label, n: i + 1 })}
          width={display.width}
          height={display.height}
          onClick={() => setOpen(url)}
        />
      ))}
      {rest > 0 ? (
        <Badge count spokenLabel={t('grid.display.moreImages', { count: rest })}>
          +{rest}
        </Badge>
      ) : null}
      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={column.label}
        size="lg"
      >
        {open ? (
          <img
            src={open}
            alt={column.label}
            className="br:mx-auto br:block br:max-h-[70vh] br:max-w-full br:object-contain"
          />
        ) : null}
      </Dialog>
    </span>
  );
}

export function QrCodeDisplay({ column, display, value }: Props<'qrcode'>) {
  const { t } = useBrume();
  const text = formatCell(value);
  if (text === '') return null;
  return (
    <Popover
      title={column.label}
      trigger={
        <IconButton
          icon={QrCodeIcon}
          size="sm"
          label={t('grid.display.showQrCode', { label: column.label })}
        />
      }
    >
      <div className="br:flex br:flex-col br:items-center br:gap-2">
        <QrCode
          value={text}
          size={display.size}
          label={t('grid.display.qrCode', { label: column.label })}
        />
        <p className="br:break-all">{text}</p>
      </div>
    </Popover>
  );
}

interface DownloadFile {
  url: string;
  name: string;
}

/** The last path segment of a URL, without query or hash. */
function fileName(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  const last = path.slice(path.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(last) || url;
  } catch {
    return last || url;
  }
}

function downloadFiles(value: unknown): DownloadFile[] {
  return (Array.isArray(value) ? value : [value]).flatMap((v): DownloadFile[] => {
    if (typeof v === 'string' && v !== '') return [{ url: v, name: fileName(v) }];
    if (v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string') {
      const { url, name } = v as { url: string; name?: unknown };
      return [{ url, name: typeof name === 'string' && name !== '' ? name : fileName(url) }];
    }
    return [];
  });
}

/** One download link per file (value: url, {url, name}, or an array of them). */
export function DownloadableDisplay({ value }: Props<'downloadable'>) {
  const files = downloadFiles(value);
  if (files.length === 0) return null;
  return (
    <span className="br:inline-flex br:max-w-full br:items-center br:gap-3">
      {files.map((file, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the same file can repeat
        <Link key={i} href={file.url} download={file.name} iconStart={Download}>
          {file.name}
        </Link>
      ))}
    </span>
  );
}
