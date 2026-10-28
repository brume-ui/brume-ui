import { CheckboxGroup, RadioGroup, Textarea, TextInput } from '@brume-ui/brume-react';
import type { InlineEditor, Option } from '@brume-ui/brume-schema';
import { type KeyboardEvent, useRef, useState } from 'react';
import { formatCell } from '../displays/format';

export type TextEditorDef = Extract<InlineEditor, { type: 'text' | 'textarea' | 'number' }>;
export type ChoiceEditorDef = Extract<InlineEditor, { type: 'select' | 'radio' | 'checkbox' }>;

/** How a text editor closed: Enter / ⌘+Enter, Esc, or focus leaving it. */
export type CloseReason = 'enter' | 'escape' | 'blur';

/** A value as the text of an input ('' for none). */
function toDraft(value: unknown): string {
  return value === null || value === undefined ? '' : formatCell(value);
}

/** The value a text editor saves: numbers as numbers ('' is null), text as typed. */
function fromDraft(editor: TextEditorDef, draft: string): unknown {
  if (editor.type !== 'number') return draft;
  const trimmed = draft.trim();
  return trimmed === '' ? null : Number(trimmed);
}

/**
 * Enter saves (⌘/Ctrl+Enter in a textarea, where Enter is a newline), Esc cancels and leaving
 * saves. Enter that picks an IME candidate never saves: `isComposing`, or keyCode 229 from
 * browsers that end the composition before the keydown. `onClose` gets the value to save, or
 * `undefined` when there is nothing to save (cancelled or unchanged); it is called once.
 */
export function TextEditor({
  editor,
  label,
  initial,
  invalid,
  describedBy,
  onClose,
}: {
  editor: TextEditorDef;
  label: string;
  initial: unknown;
  invalid?: boolean;
  describedBy?: string;
  onClose(value: unknown, reason: CloseReason): void;
}) {
  // Frozen when editing begins: a save of this cell that settles meanwhile must not make an
  // untouched draft look changed.
  const [start] = useState(() => toDraft(initial));
  const [draft, setDraft] = useState(start);
  const closed = useRef(false);

  const close = (save: boolean, reason: CloseReason) => {
    if (closed.current) return;
    closed.current = true;
    onClose(save && draft !== start ? fromDraft(editor, draft) : undefined, reason);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(false, 'escape');
      return;
    }
    if (event.key !== 'Enter') return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (editor.type === 'textarea' && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    close(true, 'enter');
  };

  const common = {
    'aria-label': label,
    'aria-describedby': describedBy,
    invalid,
    value: draft,
    autoFocus: true,
    onKeyDown,
    onBlur: () => close(true, 'blur'),
  };
  if (editor.type === 'textarea') {
    return <Textarea {...common} onChange={(e) => setDraft(e.target.value)} />;
  }
  if (editor.type === 'number') {
    return (
      <TextInput
        {...common}
        type="number"
        inputMode="decimal"
        min={editor.min}
        max={editor.max}
        step={editor.step ?? 'any'}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  }
  return (
    <TextInput
      {...common}
      maxLength={editor.maxLength}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

/** A cell value as a list of option values (checkbox). */
export function toValueList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

/** select and radio: one option, picked from a vertical list. Picking is the save. */
export function SingleChoiceEditor({
  options,
  label,
  value,
  onPick,
}: {
  options: Option[];
  label: string;
  value: unknown;
  onPick(value: string): void;
}) {
  return (
    <RadioGroup
      orientation="vertical"
      options={options}
      label={label}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={onPick}
    />
  );
}

/** checkbox: any number of options; the cell saves the set when the popover closes. */
export function MultiChoiceEditor({
  options,
  label,
  value,
  onChange,
}: {
  options: Option[];
  label: string;
  value: string[];
  onChange(value: string[]): void;
}) {
  return (
    <CheckboxGroup
      orientation="vertical"
      options={options}
      label={label}
      value={value}
      onChange={onChange}
    />
  );
}

/** The text a value shows as in an editable cell: option labels for choices, else plain text. */
export function cellText(editor: InlineEditor, value: unknown, separator: string): string {
  if (editor.type !== 'select' && editor.type !== 'radio' && editor.type !== 'checkbox') {
    return formatCell(value);
  }
  const labelOf = (v: unknown) =>
    editor.options.find((o) => o.value === String(v))?.label ?? formatCell(v);
  return Array.isArray(value) ? value.map(labelOf).join(separator) : labelOf(value);
}
