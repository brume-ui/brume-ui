import {
  Button,
  CellEditButton,
  CellError,
  Popover,
  Switch,
  TagsInput,
  useBrume,
} from '@brume-ui/brume-react';
import type { FormDef, GridRow, InlineEditor, ListColumn } from '@brume-ui/brume-schema';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Nodes } from '../../form/layout/nodes';
import { setAt } from '../../form/paths';
import { useFormState } from '../../form/use-form-state';
import { MissingComponent } from '../../missing-component';
import { useRegistry } from '../../registry-context';
import {
  type ChoiceEditorDef,
  type CloseReason,
  cellText,
  MultiChoiceEditor,
  SingleChoiceEditor,
  TextEditor,
  type TextEditorDef,
  toValueList,
} from './editors';
import { type CellUpdate, useCellUpdate } from './use-cell-update';

interface CellProps<E extends InlineEditor = InlineEditor> {
  column: ListColumn;
  row: GridRow;
  editor: E;
  /** The column's display of the confirmed value (shown while nothing is pending). */
  display: ReactNode;
}

/**
 * A cell with `column.editor`. switch and switchGroup toggle in one click; the others show the
 * value as a button that opens the editor. Without `endpoints.cell` nothing can be saved: switches
 * are disabled and the rest show their display.
 */
export function EditableCell(props: CellProps) {
  const { editor } = props;
  switch (editor.type) {
    case 'custom':
      return <CustomCell {...props} editor={editor} />;
    case 'switch':
      return <SwitchCell {...props} editor={editor} />;
    case 'switchGroup':
      return <SwitchGroupCell {...props} editor={editor} />;
    case 'select':
    case 'radio':
    case 'checkbox':
    case 'tags':
      return <ChoiceCell {...props} editor={editor} />;
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'currency':
      return <TextCell {...props} editor={editor} />;
    default: {
      const unhandled: never = editor;
      return unhandled;
    }
  }
}

/** The cell's control and, under it, its save error (the control points at it). */
function CellFrame({
  column,
  cell,
  errorId,
  children,
}: {
  column: ListColumn;
  cell: CellUpdate;
  errorId: string;
  children: ReactNode;
}) {
  // A numeric column's value sits on the end edge, like its header and its read-only cells.
  const edge = column.numeric ? 'br:items-end' : 'br:items-start';
  // With an error the cell takes a line more; the padding keeps the focus ring off the row edge.
  const room = cell.error ? ' br:py-1.5' : '';
  return (
    <div className={`br:flex br:min-w-0 br:flex-col ${edge} br:gap-1${room}`}>
      {children}
      {cell.error ? <CellError id={errorId}>{cell.error}</CellError> : null}
    </div>
  );
}

/** Displays without controls of their own, so they can render inside the edit button. */
const STATIC_DISPLAYS: ReadonlySet<string> = new Set(['text', 'label', 'badge', 'progress']);

/** What an edit button shows and announces: the pending (or held) value, else the confirmed one. */
function useCellLabel({ column, row, editor, display }: CellProps, cell: CellUpdate) {
  const { t } = useBrume();
  const separator = t('grid.listSeparator');
  const unconfirmed = cell.pending || cell.held;
  // A display renders the confirmed value; a pending one, no display, or a display with controls of
  // its own (which cannot sit inside the edit button) shows as text.
  const staticDisplay = column.display && STATIC_DISPLAYS.has(column.display.type);
  const showDisplay = !unconfirmed && staticDisplay;
  const text = cellText(
    editor,
    unconfirmed ? cell.value : row[column.key],
    separator,
    showDisplay ? column.display : undefined,
  );
  const content = showDisplay ? display : text;
  // A label or badge is a pill: the pill is the affordance, not a dashed underline.
  const pill =
    showDisplay && (column.display?.type === 'label' || column.display?.type === 'badge');
  return {
    content,
    variant: pill ? ('badge' as const) : ('text' as const),
    ariaLabel: t('grid.editCell', { label: column.label, value: text }),
  };
}

function TextCell(props: CellProps<TextEditorDef>) {
  const { column, row, editor, display } = props;
  const cell = useCellUpdate(row.id, column.key);
  const { content, variant, ariaLabel } = useCellLabel(props, cell);
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (editing || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [editing]);

  if (!cell.canSave) return display;
  const describedBy = cell.error ? errorId : undefined;

  const close = (value: unknown, reason: CloseReason) => {
    // Enter and Esc hand focus back to the cell; leaving it keeps focus where it went.
    refocus.current = reason !== 'blur';
    setEditing(false);
    if (value !== undefined) void cell.commit(value);
  };

  return (
    <CellFrame column={column} cell={cell} errorId={errorId}>
      {editing ? (
        <div className="br:w-full br:min-w-40">
          <TextEditor
            editor={editor}
            label={column.label}
            initial={cell.value}
            invalid={Boolean(cell.error)}
            describedBy={describedBy}
            onClose={close}
          />
        </div>
      ) : (
        <CellEditButton
          ref={button}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          variant={variant}
          pending={cell.pending}
          onClick={() => setEditing(true)}
        >
          {content}
        </CellEditButton>
      )}
    </CellFrame>
  );
}

/** What a choice editor edits: the option value (select, radio) or the set of them (checkbox). */
type ChoiceDraft = string | string[];

function toChoiceDraft(editor: ChoiceEditorDef, value: unknown): ChoiceDraft {
  if (editor.type === 'checkbox' || editor.type === 'tags') return toValueList(value);
  return value === null || value === undefined ? '' : String(value);
}

function sameChoice(a: ChoiceDraft, b: ChoiceDraft): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * select, radio and checkbox: the options open in a Popover from the cell. A pointer pick of a
 * single option saves it at once. From the keyboard, arrows and Space change the choice, Enter
 * saves and Esc cancels; closing the popover any other way (an outside click, Tab) saves too.
 */
function ChoiceCell(props: CellProps<ChoiceEditorDef>) {
  const { column, row, editor, display } = props;
  const cell = useCellUpdate(row.id, column.key);
  const { content, variant, ariaLabel } = useCellLabel(props, cell);
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChoiceDraft>('');
  const cancelled = useRef(false);
  const byPointer = useRef(false);

  if (!cell.canSave) return display;

  const save = (value: ChoiceDraft) => {
    if (!sameChoice(value, toChoiceDraft(editor, cell.value))) void cell.commit(value);
  };
  const onOpenChange = (next: boolean) => {
    if (next) {
      cancelled.current = false;
      setDraft(toChoiceDraft(editor, cell.value));
    } else if (!cancelled.current) {
      save(draft);
    }
    setOpen(next);
  };
  const pick = (value: string) => {
    setDraft(value);
    if (!byPointer.current) return;
    save(value);
    setOpen(false);
  };

  return (
    <CellFrame column={column} cell={cell} errorId={errorId}>
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        onEscapeKeyDown={() => {
          cancelled.current = true;
        }}
        title={column.label}
        trigger={
          <CellEditButton
            aria-label={ariaLabel}
            aria-describedby={cell.error ? errorId : undefined}
            variant={variant}
            pending={cell.pending}
          >
            {content}
          </CellEditButton>
        }
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: tells pointer picks from keyboard ones and adds Enter to save; the controls inside stay the interactive elements. */}
        <div
          onPointerDown={() => {
            byPointer.current = true;
          }}
          onKeyDown={(event) => {
            byPointer.current = false;
            if (
              event.key !== 'Enter' ||
              (editor.type === 'tags' && event.defaultPrevented) ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229
            )
              return;
            event.preventDefault();
            onOpenChange(false);
          }}
        >
          {editor.type === 'tags' ? (
            <TagsInput
              label={column.label}
              value={Array.isArray(draft) ? draft : []}
              options={editor.options}
              onChange={setDraft}
            />
          ) : editor.type === 'checkbox' ? (
            <MultiChoiceEditor
              options={editor.options}
              label={column.label}
              value={Array.isArray(draft) ? draft : []}
              onChange={setDraft}
            />
          ) : (
            <SingleChoiceEditor
              options={editor.options}
              label={column.label}
              value={draft}
              onPick={pick}
            />
          )}
        </div>
      </Popover>
    </CellFrame>
  );
}

/** true, 1, '1' and 'true' are on (a database boolean may arrive as any of them). */
function isOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function SwitchCell({ column, row, editor }: CellProps<Extract<InlineEditor, { type: 'switch' }>>) {
  const cell = useCellUpdate(row.id, column.key);
  const errorId = useId();
  const on = isOn(cell.value);
  const stateLabel = on ? editor.onLabel : editor.offLabel;
  return (
    <CellFrame column={column} cell={cell} errorId={errorId}>
      <span className="br:inline-flex br:items-center br:gap-2">
        <Switch
          label={column.label}
          checked={on}
          pending={cell.pending}
          disabled={!cell.canSave}
          aria-describedby={cell.error ? errorId : undefined}
          onCheckedChange={(next) => void cell.commit(next)}
        />
        {stateLabel ? <span>{stateLabel}</span> : null}
      </span>
    </CellFrame>
  );
}

/** One switch per key; a toggle saves `{ [key]: boolean }` and shows the whole set meanwhile. */
function SwitchGroupCell({
  column,
  row,
  editor,
}: CellProps<Extract<InlineEditor, { type: 'switchGroup' }>>) {
  const cell = useCellUpdate(row.id, column.key);
  const errorId = useId();
  const states =
    cell.value && typeof cell.value === 'object' ? (cell.value as Record<string, unknown>) : {};
  return (
    <CellFrame column={column} cell={cell} errorId={errorId}>
      <span className="br:inline-flex br:flex-wrap br:items-center br:gap-x-4 br:gap-y-1.5">
        {editor.keys.map(({ key, label }) => (
          <span key={key} className="br:inline-flex br:items-center br:gap-2">
            <Switch
              label={label}
              checked={isOn(states[key])}
              pending={cell.pending}
              disabled={!cell.canSave}
              aria-describedby={cell.error ? errorId : undefined}
              onCheckedChange={(next) =>
                void cell.commit({ [key]: next }, { ...states, [key]: next })
              }
            />
            <span aria-hidden="true">{label}</span>
          </span>
        ))}
      </span>
    </CellFrame>
  );
}

function CustomCell(props: CellProps<Extract<InlineEditor, { type: 'custom' }>>) {
  const { column, row, editor, display } = props;
  const registry = useRegistry();
  const registration = registry.getField(editor.component.name);
  const cell = useCellUpdate(row.id, column.key);
  const { content, variant, ariaLabel } = useCellLabel(props, cell);
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (editing || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [editing]);
  if (!registration) return <MissingComponent name={editor.component.name} />;
  if (!registration.inlineEditable || !cell.canSave) return display;
  const close = () => {
    refocus.current = true;
    setEditing(false);
  };
  // The open draft owns a real FormApi and declaration tree. Remounting starts a new session.
  return (
    <CellFrame column={column} cell={editing ? { ...cell, error: null } : cell} errorId={errorId}>
      {editing ? (
        <CustomEditorSession {...props} cell={cell} onClose={close} />
      ) : (
        <CellEditButton
          ref={button}
          aria-label={ariaLabel}
          aria-describedby={cell.error ? errorId : undefined}
          variant={variant}
          pending={cell.pending}
          disabled={cell.pending}
          onClick={() => setEditing(true)}
        >
          {content}
        </CellEditButton>
      )}
    </CellFrame>
  );
}

function CustomEditorSession({
  column,
  row,
  editor,
  cell,
  onClose,
}: CellProps<Extract<InlineEditor, { type: 'custom' }>> & {
  cell: CellUpdate;
  onClose(): void;
}) {
  const { t } = useBrume();
  const id = useId();
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: {
          type: 'custom',
          name: column.key,
          label: column.label,
          component: editor.component,
          rules: editor.rules,
        },
      },
    ],
  };
  const form = useFormState(definition, setAt({ ...row }, column.key, cell.value), t);
  const session = useRef(form);
  session.current = form;
  const root = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    root.current
      ?.querySelector<HTMLElement>('input,select,textarea,button,[tabindex="0"]')
      ?.focus();
    return () => {
      alive.current = false;
    };
  }, []);
  const save = async () => {
    if (form.submitting || form.pendingUploads || !form.validateAll()) return;
    form.setSubmitting(true);
    const saved = await cell.commit(form.getValue(column.key));
    if (!alive.current) return;
    form.setSubmitting(false);
    if (saved) onClose();
  };
  useEffect(() => {
    if (!cell.error) return;
    session.current.setServerErrors(
      Object.fromEntries(Object.entries(cell.errors).map(([path, errors]) => [path, [...errors]])),
    );
  }, [cell.errors, cell.error]);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: descendant inputs keep semantics; session handles save/cancel keys
    <div
      ref={root}
      className="br:w-full br:min-w-40 br:whitespace-normal br:grid br:gap-2"
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229)
          return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (
          event.key === 'Enter' &&
          event.target instanceof HTMLInputElement &&
          !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(event.target.type)
        ) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <Nodes nodes={definition.nodes} api={form} idPrefix={id} layout="stacked" />
      <div className="br:flex br:gap-2">
        <Button disabled={form.submitting || form.pendingUploads > 0} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
