import {
  Component,
  type ComponentType,
  type DragEvent,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { cn } from '../../cn';
import { isSafeHref } from '../../http';
import type { Locale } from '../../i18n';
import { useBrume } from '../../provider';
import { Button } from '../button';
import { ariaOn, type FieldControlProps } from '../field';
import { Skeleton } from '../skeleton';
import { toast } from '../toast-store';
import { formatLimit, formatTypes } from '../upload-list';
import type {
  JoditEditorProps,
  JoditLanguage,
  RichTextMessages,
  RichTextUploadResult,
} from './editor-contract';
import { RichTextView } from './rich-text-view';

export type { RichTextUploadResult } from './editor-contract';

export interface RichTextEditorProps extends FieldControlProps {
  value: string | null;
  /** Receives null when the document is empty (`<p><br></p>`, `&nbsp;`, whitespace). */
  onChange(html: string | null): void;
  onBlur?(): void;
  /** Outer height in px, toolbar included. Default 500. */
  height?: number;
  /** Site stylesheets applied inside the editing document. */
  contentCss?: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Shows the read-only `RichTextView`; the editor chunk is not loaded. */
  readOnly?: boolean;
  /** Accepted image files for paste/drop upload. */
  images?: { accept: string[]; maxSize: number };
  /** Without it (or without `images`), pasted/dropped image files are ignored with a toast. */
  upload?(file: File, signal: AbortSignal): Promise<RichTextUploadResult>;
  /** Accessible name of the editing area. */
  label: string;
}

/**
 * The Jodit chunk, loaded on first use. An object so tests can replace `load`; the literal
 * `import()` is what makes the bundler emit Jodit as a separate chunk.
 */
export const editorChunk = {
  load: (): Promise<{ default: ComponentType<JoditEditorProps> }> => import('./jodit-editor'),
};

const LANGUAGES: Record<Locale, JoditLanguage> = { 'zh-TW': 'zh_tw', 'zh-CN': 'zh_cn', en: 'en' };

function accepts(accept: readonly string[], file: File): boolean {
  return accept.some((raw) => {
    const value = raw.toLowerCase();
    const type = file.type.toLowerCase();
    if (value.startsWith('.')) return file.name.toLowerCase().endsWith(value);
    if (value.endsWith('/*')) return type.startsWith(value.slice(0, -1));
    return type === value;
  });
}

class ChunkBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A file drag must never reach the browser's default (open the file, replacing the page). */
function blockFileDrop(e: DragEvent<HTMLDivElement>) {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
}

/**
 * One Jodit instance (keyed). Its unmount (remount for new options, readOnly, unmount) resets the
 * shell's upload counter: uploads of a destructed instance are aborted and never report back.
 */
function EditorInstance({
  Editor,
  onGone,
  ...props
}: JoditEditorProps & { Editor: ComponentType<JoditEditorProps>; onGone(): void }) {
  useEffect(() => onGone, [onGone]);
  return <Editor {...props} />;
}

function EditorSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="br:flex br:h-full br:flex-col">
      <div className="br:flex br:shrink-0 br:items-center br:gap-2 br:border-b br:border-border br:px-3 br:py-2.5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="br:h-5 br:w-6 br:rounded-input" />
        ))}
      </div>
      <div className="br:grid br:gap-3 br:p-4">
        <Skeleton className="br:w-3/4" />
        <Skeleton className="br:w-full" />
        <Skeleton className="br:w-2/3" />
      </div>
    </div>
  );
}

/**
 * Rich text (HTML) editor: Jodit 4 in iframe mode, loaded lazily so apps that never show an editor
 * do not download it. Use it in a `Field` with `group` (a `<label for>` cannot name an iframe).
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  height = 500,
  contentCss,
  placeholder,
  disabled = false,
  readOnly = false,
  images,
  upload,
  label,
  id,
  invalid,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: RichTextEditorProps) {
  const { t, locale } = useBrume();
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState(0);
  // A new lazy component per attempt: React.lazy caches a rejected load.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the retry trigger.
  const Editor = useMemo(() => lazy(() => editorChunk.load()), [attempt]);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  // Same rule as the view: stylesheet URLs must be relative, http: or https:.
  const css = useMemo(
    () => (contentCss ?? []).filter((href) => href.trim() !== '' && isSafeHref(href)),
    [contentCss],
  );

  const messages = useMemo<RichTextMessages>(
    () => ({
      uploading: t('upload.uploading'),
      uploadFailed: t('upload.failed'),
      imagesDisabled: t('richText.imagesDisabled'),
      videoTitle: t('richText.videoTitle'),
      videoUrl: t('richText.videoUrl'),
      videoInsert: t('richText.videoInsert'),
      youtubeOnly: t('richText.youtubeOnly'),
      imagesDropped: (count: number) => t('richText.imagesDropped', { count }),
      blockLabels: {
        p: t('richText.paragraph'),
        h1: t('richText.heading', { level: 1 }),
        h2: t('richText.heading', { level: 2 }),
        h3: t('richText.heading', { level: 3 }),
      },
      required: t('field.required'),
    }),
    [t],
  );

  const validateImage = useCallback(
    (file: File): string | null => {
      if (!images) return t('richText.imagesDisabled');
      if (!accepts(images.accept, file))
        return t('upload.type', { types: formatTypes(images.accept, locale) });
      if (file.size > images.maxSize)
        return t('upload.size', { max: formatLimit(images.maxSize, locale) });
      return null;
    },
    [images, locale, t],
  );

  const safeUpload = useCallback(
    async (file: File, signal: AbortSignal): Promise<RichTextUploadResult> => {
      if (!upload) return { ok: false, message: t('richText.imagesDisabled') };
      const result = await upload(file, signal);
      // The URL becomes an <img src> in the document: relative, http: or https: only.
      if (result.ok && (!result.url || !isSafeHref(result.url)))
        return { ok: false, message: t('upload.failed') };
      return result;
    },
    [upload, t],
  );

  const onUploadingChange = useCallback((delta: 1 | -1) => {
    setUploading((n) => Math.max(0, n + delta));
  }, []);

  const resetUploading = useCallback(() => setUploading(0), []);

  const notify = useCallback((message: string) => {
    toast.error(message);
  }, []);

  if (readOnly) {
    return (
      <RichTextView
        id={id}
        aria-describedby={describedBy}
        html={value}
        contentCss={css}
        maxHeight={height}
        label={label}
      />
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop guard only (stops the browser opening a dropped file), not an interaction.
    <div
      id={id}
      data-disabled={disabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
      data-uploading={uploading > 0 ? String(uploading) : undefined}
      style={{ height }}
      onDragOver={blockFileDrop}
      onDrop={blockFileDrop}
      className={cn(
        'br-rich-text br:relative br:w-full br:overflow-hidden br:rounded-input br:border br:bg-surface br:text-text',
        'br:transition-[border-color] br:duration-fast br:ease-out',
        isInvalid
          ? 'br:border-danger'
          : disabled
            ? 'br:border-border'
            : 'br:border-border-strong br:hover:border-text-muted',
        'br:outline-none br:focus-within:outline-solid br:focus-within:outline-2 br:focus-within:outline-offset-2',
        isInvalid ? 'br:focus-within:outline-danger' : 'br:focus-within:outline-focus-ring',
        disabled && 'br:cursor-not-allowed',
      )}
    >
      <ChunkBoundary
        key={attempt}
        fallback={
          <div
            role="alert"
            className="br:flex br:h-full br:flex-col br:items-center br:justify-center br:gap-3 br:p-4 br:text-center br:text-sm br:text-text-muted"
          >
            <p>{t('richText.loadFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {t('richText.retry')}
            </Button>
          </div>
        }
      >
        <Suspense fallback={<EditorSkeleton label={t('richText.loading')} />}>
          <EditorInstance
            // New language, stylesheets, height or placeholder: a new Jodit instance.
            key={`${LANGUAGES[locale] ?? 'zh_tw'}|${css.join('\n')}|${height}|${placeholder ?? ''}`}
            Editor={Editor}
            onGone={resetUploading}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            height={height}
            contentCss={css}
            placeholder={placeholder}
            disabled={disabled}
            language={LANGUAGES[locale] ?? 'zh_tw'}
            label={label}
            labelledBy={labelledBy}
            describedBy={describedBy}
            invalid={isInvalid}
            required={ariaOn(ariaRequired)}
            imagesEnabled={Boolean(images && images.accept.length > 0 && upload)}
            validateImage={validateImage}
            upload={safeUpload}
            onUploadingChange={onUploadingChange}
            notify={notify}
            messages={messages}
          />
        </Suspense>
      </ChunkBoundary>
    </div>
  );
}
