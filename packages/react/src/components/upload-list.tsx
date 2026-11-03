import type { UploadTempResponse, UploadValue } from '@brume-ui/brume-schema';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  File,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { isSafeHref } from '../http';
import { useBrume } from '../provider';
import { buttonClasses } from './button';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

/** Tile actions appear on hover or focus (always on touch screens), over a surface chip. */
const TILE_ACTIONS =
  'br:transition-opacity br:duration-fast br:ease-out br:[@media(hover:hover)]:opacity-0 br:[@media(hover:hover)]:group-hover/tile:opacity-100 br:[@media(hover:hover)]:group-focus-within/tile:opacity-100';
const TILE_BUTTON =
  'br:size-6 br:bg-[color-mix(in_oklab,var(--br-surface)_88%,transparent)] br:text-text br:shadow-row br:hover:bg-surface';

export interface UploadItem {
  key: string;
  status: 'uploading' | 'done' | 'error';
  name: string;
  size?: number;
  previewUrl?: string;
  url?: string;
  error?: string;
  value?: UploadValue;
}
export interface UploadListProps extends FieldControlProps {
  kind: 'image' | 'file';
  multiple: boolean;
  accept: string[];
  maxSize: number;
  maxFiles?: number;
  sortable?: boolean;
  items: UploadItem[];
  onItemsChange(items: UploadItem[]): void;
  upload(
    file: File,
    signal: AbortSignal,
  ): Promise<{ ok: true; value: UploadTempResponse } | { ok: false; message: string }>;
  /** Per-file fields (alt text, caption). Images with extras use rows instead of tiles. */
  renderExtra?(item: UploadItem, index: number): ReactNode;
  hasExtras?: boolean;
  itemErrors?(index: number): string | undefined;
  label: string;
  disabled?: boolean;
}

/** Decimal byte units, with the number formatted in the active locale. */
export function formatBytes(n: number, locale: string): string {
  const size = Math.max(0, n);
  const unit = size === 0 ? 0 : Math.min(4, Math.floor(Math.log10(size) / 3));
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size / 1000 ** Math.max(0, unit))} ${['B', 'KB', 'MB', 'GB', 'TB'][Math.max(0, unit)]}`;
}

/** A size limit as people write it: 10485760 is 「10 MB」, not 「10.5 MB」. */
export function formatLimit(n: number, locale: string): string {
  if (n <= 0 || n % 1024 !== 0) return formatBytes(n, locale);
  const unit = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    n / 1024 ** unit,
  );
  return `${value} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}

const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
  'image/heic': 'HEIC',
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/zip': 'ZIP',
  'application/json': 'JSON',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
};

/** Accept entries as people name formats: `image/jpeg` → JPG, `.pdf` → PDF; wildcards stay readable. */
export function formatTypes(accept: readonly string[], locale: string): string {
  const names = accept.map((raw) => {
    const type = raw.toLowerCase();
    if (TYPE_NAMES[type]) return TYPE_NAMES[type];
    if (type.startsWith('.')) return type.slice(1).toUpperCase();
    if (type.endsWith('/*')) return raw;
    const sub = type.split('/')[1] ?? type;
    return sub.replace(/^x-/, '').toUpperCase();
  });
  return [...new Set(names)].join(locale.startsWith('zh') ? '、' : ', ');
}

/** Controlled, transport-independent uploads. Removed/replaced requests are aborted and ignored. */
export function UploadList({
  kind,
  multiple,
  accept,
  maxSize,
  maxFiles,
  sortable,
  items,
  onItemsChange,
  upload,
  renderExtra,
  hasExtras = renderExtra !== undefined,
  itemErrors,
  label,
  disabled,
  id,
  invalid,
  ...aria
}: UploadListProps) {
  const { t, locale } = useBrume();
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-constraints`;
  const hint = t('upload.constraints', {
    types: accept.length ? formatTypes(accept, locale) : t('upload.anyType'),
    size: formatLimit(maxSize, locale),
  });
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFieldSetElement>(null);
  const current = useRef(items);
  current.current = items;
  const controllers = useRef(new Map<string, AbortController>());
  const sequence = useRef(0);
  const dragged = useRef<string | null>(null);
  const focusKey = useRef<string | null>(null);
  const [over, setOver] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const change = (next: UploadItem[]) => {
    current.current = next;
    onItemsChange(next);
  };

  useEffect(() => {
    for (const [key, controller] of controllers.current) {
      if (!items.some((item) => item.key === key)) {
        controller.abort();
        controllers.current.delete(key);
      }
    }
    if (focusKey.current) {
      const row = Array.from(
        root.current?.querySelectorAll<HTMLLIElement>('li[data-upload-key]') ?? [],
      ).find((el) => el.dataset.uploadKey === focusKey.current);
      row?.focus();
      focusKey.current = null;
    }
  }, [items]);
  useEffect(() => {
    const requests = controllers.current;
    return () => {
      for (const controller of requests.values()) controller.abort();
      requests.clear();
    };
  }, []);

  const add = (files: File[]) => {
    if (disabled || files.length === 0) return;
    if (!multiple) {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    }
    const next = multiple ? [...current.current] : [];
    const jobs: { file: File; item: UploadItem; controller: AbortController }[] = [];
    for (const file of multiple ? files : files.slice(0, 1)) {
      const supported =
        accept.length === 0 ||
        accept.some((type) => {
          const value = type.toLowerCase();
          return value.startsWith('.')
            ? file.name.toLowerCase().endsWith(value)
            : value.endsWith('/*')
              ? file.type.toLowerCase().startsWith(value.slice(0, -1))
              : file.type.toLowerCase() === value;
        });
      const error = !supported
        ? t('upload.type', { types: formatTypes(accept, locale) })
        : file.size > maxSize
          ? t('upload.size', { max: formatLimit(maxSize, locale) })
          : maxFiles !== undefined && next.length >= maxFiles
            ? t('upload.maxFiles', { max: maxFiles })
            : undefined;
      const item: UploadItem = {
        key: `${autoId}-${++sequence.current}`,
        name: file.name,
        size: file.size,
        status: error ? 'error' : 'uploading',
        ...(error ? { error } : {}),
      };
      next.push(item);
      if (!error) {
        const controller = new AbortController();
        controllers.current.set(item.key, controller);
        jobs.push({ file, item, controller });
      }
    }
    change(next);
    for (const { file, item, controller } of jobs) {
      const finish = (patch: Partial<UploadItem>) => {
        if (controller.signal.aborted) return;
        controllers.current.delete(item.key);
        if (current.current.some((x) => x.key === item.key))
          change(current.current.map((x) => (x.key === item.key ? { ...x, ...patch } : x)));
      };
      void (async () => {
        try {
          const response = await upload(file, controller.signal);
          if (response.ok)
            finish({
              status: 'done',
              name: response.value.name,
              size: response.value.size,
              previewUrl: response.value.previewUrl,
              value: { token: response.value.token },
            });
          else finish({ status: 'error', error: response.message });
        } catch {
          finish({ status: 'error', error: t('upload.failed') });
        }
      })();
    }
  };
  const move = (key: string, to: number) => {
    if (disabled || !sortable) return;
    const next = [...current.current];
    const from = next.findIndex((x) => x.key === key);
    if (from < 0 || to < 0 || to >= next.length || from === to) return;
    const item = next.splice(from, 1)[0];
    if (!item) return;
    next.splice(to, 0, item);
    focusKey.current = key;
    change(next);
  };
  const isInvalid = invalid || ariaOn(aria['aria-invalid']) || undefined;
  const describedBy = [aria['aria-describedby'], hintId].filter(Boolean).join(' ');
  // Image fields without per-file extras show tiles; files (and images with extras) show rows.
  const tiles = kind === 'image' && !hasExtras;
  const canAdd = multiple ? maxFiles === undefined || items.length < maxFiles : items.length === 0;
  const remove = (key: string) => {
    if (disabled) return;
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
    change(current.current.filter((x) => x.key !== key));
    (addRef.current ?? input.current)?.focus();
  };
  const view = items.map((item, index) => {
    const error = itemErrors?.(index) ?? item.error;
    const preview =
      item.previewUrl && isSafeHref(item.previewUrl)
        ? item.previewUrl
        : item.url && isSafeHref(item.url)
          ? item.url
          : undefined;
    const href = item.url && isSafeHref(item.url) ? item.url : preview;
    return { item, index, error, errorId: `${inputId}-error-${index}`, preview, href };
  });
  const rowProps = (key: string, index: number, errorId: string | undefined) => ({
    'data-upload-key': key,
    tabIndex: -1,
    'aria-describedby': errorId,
    onDragOver: (e: DragEvent) => {
      if (sortable && !disabled && dragged.current) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      if (!dragged.current) return;
      e.preventDefault();
      e.stopPropagation();
      move(dragged.current, index);
      dragged.current = null;
    },
  });
  const sortControls = (item: UploadItem, index: number, onTile: boolean) =>
    sortable ? (
      <>
        <IconButton
          size="sm"
          icon={GripVertical}
          label={t('upload.sort', { name: item.name })}
          disabled={disabled}
          draggable={!disabled}
          className={onTile ? TILE_BUTTON : undefined}
          onDragStart={(e) => {
            if (disabled) return;
            dragged.current = item.key;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.key);
          }}
          onDragEnd={() => {
            dragged.current = null;
          }}
        />
        <IconButton
          size="sm"
          icon={onTile ? ArrowLeft : ArrowUp}
          label={t('upload.up', { name: item.name })}
          disabled={disabled || index === 0}
          className={onTile ? TILE_BUTTON : undefined}
          onClick={() => move(item.key, index - 1)}
        />
        <IconButton
          size="sm"
          icon={onTile ? ArrowRight : ArrowDown}
          label={t('upload.down', { name: item.name })}
          disabled={disabled || index === items.length - 1}
          className={onTile ? TILE_BUTTON : undefined}
          onClick={() => move(item.key, index + 1)}
        />
      </>
    ) : null;
  const removeButton = (item: UploadItem, onTile: boolean) => (
    <IconButton
      size="sm"
      icon={X}
      label={t('upload.remove', { name: item.name })}
      disabled={disabled}
      className={onTile ? TILE_BUTTON : undefined}
      onClick={() => remove(item.key)}
    />
  );
  const progress = (
    <div
      role="progressbar"
      aria-label={t('upload.uploading')}
      className="br:h-1 br:w-full br:overflow-hidden br:rounded-pill br:bg-accent-tint"
    >
      <div className="br:h-full br:w-1/3 br:rounded-pill br:bg-accent" />
    </div>
  );
  const addButton = (
    <button
      ref={addRef}
      type="button"
      aria-invalid={isInvalid}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => input.current?.click()}
      className={cn(
        tiles
          ? 'br:flex br:size-24 br:flex-col br:items-center br:justify-center br:gap-1 br:rounded-card br:border br:border-dashed br:text-xs br:text-text-muted br:transition-colors br:duration-fast br:ease-out br:enabled:hover:border-accent br:enabled:hover:bg-accent-tint br:enabled:hover:text-accent-tint-text br:disabled:cursor-not-allowed br:disabled:opacity-50'
          : buttonClasses('secondary', 'sm'),
        tiles &&
          (isInvalid
            ? 'br:border-danger'
            : 'br:border-[color-mix(in_oklab,var(--br-border-strong)_60%,var(--br-surface))]'),
        !tiles && 'br:disabled:cursor-not-allowed br:disabled:opacity-50',
        !tiles && isInvalid && 'br:border-danger',
        FOCUS_RING,
      )}
    >
      {tiles ? (
        <Plus aria-hidden="true" className="br:size-5" />
      ) : (
        <Upload aria-hidden="true" className="br:size-4" />
      )}
      <span>{tiles ? t('upload.addImage') : t('upload.chooseFile')}</span>
    </button>
  );
  const hintText = (
    <span id={hintId} className="br:text-xs br:leading-5 br:text-text-muted">
      {hint}
    </span>
  );
  return (
    <fieldset
      ref={root}
      aria-label={aria['aria-labelledby'] ? undefined : label}
      aria-labelledby={aria['aria-labelledby']}
      aria-busy={items.some((item) => item.status === 'uploading')}
      data-drag-over={over || undefined}
      // Files can be dropped anywhere on the field; the whole field lights up instead of a drop box.
      onDragOver={(e) => {
        if (dragged.current) return;
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!dragged.current) add(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        'br:m-0 br:min-w-0 br:border-0 br:p-0 br:grid br:gap-2 br:rounded-card br:outline-offset-4 br:transition-colors br:duration-fast br:ease-out',
        over && 'br:bg-accent-tint br:outline-2 br:outline-dashed br:outline-accent',
      )}
    >
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        {...aria}
        aria-describedby={describedBy}
        aria-invalid={isInvalid}
        className="br:sr-only"
        onChange={(e) => {
          add(Array.from(e.currentTarget.files ?? []));
          e.currentTarget.value = '';
        }}
      />
      {tiles ? (
        <>
          <ul className="br:m-0 br:flex br:list-none br:flex-wrap br:gap-3 br:p-0">
            {view.map(({ item, index, error, errorId, preview, href }) => (
              <li
                key={item.key}
                {...rowProps(item.key, index, error ? errorId : undefined)}
                className={cn(
                  'br:group/tile br:relative br:size-24 br:overflow-hidden br:rounded-card br:border br:bg-surface-canvas',
                  error ? 'br:border-danger' : 'br:border-border',
                  FOCUS_RING,
                )}
              >
                {preview ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="br:block br:size-full"
                  >
                    <img src={preview} alt={item.name} className="br:size-full br:object-cover" />
                    <span className="br:sr-only">{t('link.newTab')}</span>
                  </a>
                ) : (
                  <div className="br:flex br:size-full br:flex-col br:items-center br:justify-center br:gap-1 br:px-2 br:text-text-muted">
                    <ImageIcon aria-hidden="true" className="br:size-5" />
                    <span title={item.name} className="br:max-w-full br:truncate br:text-xs">
                      {item.name}
                    </span>
                  </div>
                )}
                {item.status === 'uploading' ? (
                  <div className="br:absolute br:inset-x-2 br:bottom-2">
                    <p role="status" className="br:sr-only">
                      {t('upload.uploading')}
                    </p>
                    {progress}
                  </div>
                ) : null}
                <div className={cn('br:absolute br:top-1 br:right-1', TILE_ACTIONS)}>
                  {removeButton(item, true)}
                </div>
                {sortable ? (
                  <div
                    className={cn(
                      'br:absolute br:bottom-1 br:left-1 br:flex br:gap-0.5',
                      TILE_ACTIONS,
                    )}
                  >
                    {sortControls(item, index, true)}
                  </div>
                ) : null}
              </li>
            ))}
            {canAdd ? <li>{addButton}</li> : null}
          </ul>
          {view.some((v) => v.error) ? (
            <ul className="br:m-0 br:grid br:list-none br:gap-1 br:p-0">
              {view.map(({ item, error, errorId }) =>
                error ? (
                  <li key={item.key} className="br:text-[13px] br:text-danger">
                    {item.name}
                    {t('form.errorSeparator')}
                    <span id={errorId}>{error}</span>
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
          {hintText}
        </>
      ) : (
        <>
          <div className="br:flex br:flex-wrap br:items-center br:gap-x-3 br:gap-y-1">
            {canAdd ? addButton : null}
            {hintText}
          </div>
          {items.length ? (
            <ul className="br:m-0 br:list-none br:divide-y br:divide-border br:rounded-card br:border br:border-border br:p-0">
              {view.map(({ item, index, error, errorId, preview, href }) => (
                <li
                  key={item.key}
                  {...rowProps(item.key, index, error ? errorId : undefined)}
                  className={cn(
                    'br:grid br:gap-2 br:px-3 br:py-2 br:text-sm br:text-text br:first:rounded-t-card br:last:rounded-b-card',
                    FOCUS_RING,
                  )}
                >
                  <div className="br:flex br:items-center br:gap-3">
                    {kind === 'image' && preview ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="br:shrink-0"
                      >
                        <img
                          src={preview}
                          alt={item.name}
                          className="br:size-10 br:rounded-input br:object-cover"
                        />
                        <span className="br:sr-only">{t('link.newTab')}</span>
                      </a>
                    ) : (
                      <span className="br:flex br:size-10 br:shrink-0 br:items-center br:justify-center br:rounded-input br:bg-surface-canvas br:text-text-muted">
                        <File aria-hidden="true" className="br:size-4" />
                      </span>
                    )}
                    <div className="br:min-w-0 br:flex-1">
                      <span title={item.name} className="br:block br:truncate">
                        {item.name}
                      </span>
                      {item.status === 'uploading' ? (
                        <p role="status" className="br:text-xs br:text-text-muted">
                          {t('upload.uploading')}
                        </p>
                      ) : item.size !== undefined ? (
                        <span className="br:block br:text-xs br:text-text-muted">
                          {formatBytes(item.size, locale)}
                        </span>
                      ) : null}
                    </div>
                    <div className="br:flex br:shrink-0 br:items-center br:gap-0.5">
                      {sortControls(item, index, false)}
                      {removeButton(item, false)}
                    </div>
                  </div>
                  {item.status === 'uploading' ? progress : null}
                  {error ? (
                    <p id={errorId} className="br:text-[13px] br:text-danger">
                      {error}
                    </p>
                  ) : null}
                  {renderExtra?.(item, index)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </fieldset>
  );
}
