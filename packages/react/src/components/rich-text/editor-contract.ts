/**
 * What the light `RichTextEditor` shell hands the lazily loaded Jodit chunk. Types only: the shell
 * must not import anything at runtime that would pull Jodit (or the Task 2 helpers it uses) into
 * the main bundle.
 */

/** `name`: the uploaded file's name; without its extension it becomes the image's initial alt text. */
export type RichTextUploadResult =
  | { ok: true; url: string; name?: string }
  | { ok: false; message: string };

export type JoditLanguage = 'zh_tw' | 'zh_cn' | 'en';

export interface RichTextMessages {
  uploading: string;
  uploadFailed: string;
  imagesDisabled: string;
  videoTitle: string;
  videoUrl: string;
  videoInsert: string;
  youtubeOnly: string;
  /** Pasted HTML held images that cannot be kept (data:, file:): how to add them instead. */
  imagesDropped(count: number): string;
  /** The paragraph menu: body text and headings 1-3. */
  blockLabels: { p: string; h1: string; h2: string; h3: string };
  /** Added to the editing area's accessible name when the field is required. */
  required: string;
}

export interface JoditEditorProps {
  value: string | null;
  onChange(html: string | null): void;
  onBlur?(): void;
  /** Outer height of the whole editor (toolbar included), inside the shell's border. */
  height: number;
  contentCss: string[];
  placeholder?: string;
  disabled: boolean;
  language: JoditLanguage;
  /** Accessible name of the editing area. */
  label: string;
  labelledBy?: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  /** Pasted/dropped image files are uploaded; otherwise they are ignored with `notify`. */
  imagesEnabled: boolean;
  /** Client-side type/size check: the message to show, or null when the file may be uploaded. */
  validateImage(file: File): string | null;
  /** Already checked by the shell: an `ok` result always carries a safe URL. */
  upload(file: File, signal: AbortSignal): Promise<RichTextUploadResult>;
  onUploadingChange(delta: 1 | -1): void;
  notify(message: string): void;
  messages: RichTextMessages;
}
