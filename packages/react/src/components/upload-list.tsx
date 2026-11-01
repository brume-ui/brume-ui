import type { UploadTempResponse, UploadValue } from '@brume-ui/brume-schema';
import { ArrowDown, ArrowUp, File, GripVertical, Upload, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { isSafeHref } from '../http';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

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
  renderExtra?(item: UploadItem, index: number): ReactNode;
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
    types: accept.length ? accept.join(', ') : t('upload.anyType'),
    size: formatBytes(maxSize, locale),
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
        ? t('upload.type', { types: accept.join(', ') })
        : file.size > maxSize
          ? t('upload.size', { max: formatBytes(maxSize, locale) })
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
  return (
    <fieldset
      ref={root}
      aria-label={aria['aria-labelledby'] ? undefined : label}
      aria-labelledby={aria['aria-labelledby']}
      aria-busy={items.some((item) => item.status === 'uploading')}
      className="br:flex br:flex-col br:gap-3"
    >
      <button
        type="button"
        aria-invalid={invalid || ariaOn(aria['aria-invalid']) || undefined}
        aria-describedby={[aria['aria-describedby'], hintId].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!dragged.current) add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'br:min-h-24 br:flex br:flex-col br:items-center br:justify-center br:gap-1 br:rounded-card br:border br:border-dashed br:px-4 br:py-3 br:text-sm br:text-text br:enabled:hover:border-accent br:enabled:hover:bg-accent-tint br:disabled:opacity-50',
          FOCUS_RING,
          over ? 'br:border-accent br:bg-accent-tint' : 'br:border-border-strong',
          (invalid || ariaOn(aria['aria-invalid'])) && 'br:border-danger',
        )}
      >
        <Upload aria-hidden="true" className="br:size-5 br:text-text-muted" />
        <span>{t('upload.drop')}</span>
        <span id={hintId} className="br:text-xs br:text-text-muted">
          {hint}
        </span>
      </button>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        {...aria}
        aria-describedby={[aria['aria-describedby'], hintId].filter(Boolean).join(' ')}
        aria-invalid={invalid || ariaOn(aria['aria-invalid']) || undefined}
        className="br:sr-only"
        onChange={(e) => {
          add(Array.from(e.currentTarget.files ?? []));
          e.currentTarget.value = '';
        }}
      />
      <ul className="br:flex br:flex-col br:gap-2">
        {items.map((item, index) => {
          const error = itemErrors?.(index) ?? item.error;
          const errorId = `${inputId}-error-${index}`;
          const preview =
            item.previewUrl && isSafeHref(item.previewUrl)
              ? item.previewUrl
              : item.url && isSafeHref(item.url)
                ? item.url
                : undefined;
          const href = item.url && isSafeHref(item.url) ? item.url : preview;
          return (
            <li
              key={item.key}
              data-upload-key={item.key}
              tabIndex={-1}
              aria-describedby={error ? errorId : undefined}
              onDragOver={(e) => {
                if (sortable && !disabled) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dragged.current) return;
                e.preventDefault();
                e.stopPropagation();
                move(dragged.current, index);
                dragged.current = null;
              }}
              className={cn(
                'br:rounded-input br:border br:border-border br:p-3 br:text-sm br:text-text',
                FOCUS_RING,
              )}
            >
              <div className="br:flex br:items-center br:gap-2">
                {sortable ? (
                  <IconButton
                    size="sm"
                    icon={GripVertical}
                    label={t('upload.sort', { name: item.name })}
                    disabled={disabled}
                    draggable={!disabled}
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
                ) : null}
                {kind === 'image' && preview ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <img
                      src={preview}
                      alt={item.name}
                      className="br:size-12 br:shrink-0 br:rounded-input br:object-cover"
                    />
                    <span className="br:sr-only">{t('link.newTab')}</span>
                  </a>
                ) : (
                  <File
                    aria-hidden="true"
                    className="br:size-12 br:shrink-0 br:p-3 br:text-text-muted"
                  />
                )}
                <div className="br:min-w-0 br:flex-1">
                  <span title={item.name} className="br:block br:truncate">
                    {item.name}
                  </span>
                  {item.size !== undefined ? (
                    <span className="br:block br:text-xs br:text-text-muted">
                      {formatBytes(item.size, locale)}
                    </span>
                  ) : null}
                  {item.status === 'uploading' ? (
                    <p role="status">{t('upload.uploading')}</p>
                  ) : null}
                </div>
                {sortable ? (
                  <>
                    <IconButton
                      size="sm"
                      icon={ArrowUp}
                      label={t('upload.up', { name: item.name })}
                      disabled={disabled || index === 0}
                      onClick={() => move(item.key, index - 1)}
                    />
                    <IconButton
                      size="sm"
                      icon={ArrowDown}
                      label={t('upload.down', { name: item.name })}
                      disabled={disabled || index === items.length - 1}
                      onClick={() => move(item.key, index + 1)}
                    />
                  </>
                ) : null}
                <IconButton
                  size="sm"
                  icon={X}
                  label={t('upload.remove', { name: item.name })}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    controllers.current.get(item.key)?.abort();
                    controllers.current.delete(item.key);
                    change(current.current.filter((x) => x.key !== item.key));
                    input.current?.focus();
                  }}
                />
              </div>
              {item.status === 'uploading' ? (
                <div
                  role="progressbar"
                  aria-label={t('upload.uploading')}
                  className="br:mt-2 br:h-1 br:rounded-pill br:bg-accent-tint"
                >
                  <div className="br:h-full br:w-1/3 br:rounded-pill br:bg-accent" />
                </div>
              ) : null}
              {error ? (
                <p id={errorId} className="br:text-danger">
                  {error}
                </p>
              ) : null}
              {renderExtra?.(item, index)}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
