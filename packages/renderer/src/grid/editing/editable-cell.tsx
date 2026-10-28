import { CellEditButton, CellError, Popover, Switch, useBrume } from '@brume-ui/brume-react';
import type { GridRow, InlineEditor, ListColumn } from '@brume-ui/brume-schema';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
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
    case 'switch':
      return <SwitchCell {...props} editor={editor} />;
    case 'switchGroup':
      return <SwitchGroupCell {...props} editor={editor} />;
    case 'select':
    case 'radio':
    case 'checkbox':
      return <ChoiceCell {...props} editor={editor} />;
    default:
      return <TextCell {...props} editor={editor} />;
  }
}

/** The cell's control and, under it, its save error (the control points at it). */
function CellFrame({
  cell,
  errorId,
  children,
}: {
  cell: CellUpdate;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="br:flex br:min-w-0 br:flex-col br:items-start br:gap-1">
      {children}
      {cell.error ? <CellError id={errorId}>{cell.error}</CellError> : null}
    </div>
  );
}

/** What an edit button shows and announces: the pending value, else the confirmed one. */
function useCellLabel({ column, row, editor, display }: CellProps, cell: CellUpdate) {
  const { t } = useBrume();
  const separator = t('grid.listSeparator');
  const text = cellText(editor, cell.pending ? cell.value : row[column.key], separator);
  // A display renders the confirmed value; a pending one (or no display) shows as text.
  const content = cell.pending || !column.display ? text : display;
  return { content, ariaLabel: t('grid.editCell', { label: column.label, value: text }) };
}

function TextCell(props: CellProps<TextEditorDef>) {
  const { column, row, editor, display } = props;
  const cell = useCellUpdate(row.id, column.key);
  const { content, ariaLabel } = useCellLabel(props, cell);
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
    <CellFrame cell={cell} errorId={errorId}>
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
  if (editor.type === 'checkbox') return toValueList(value);
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
  const { content, ariaLabel } = useCellLabel(props, cell);
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
    <CellFrame cell={cell} errorId={errorId}>
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
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            onOpenChange(false);
          }}
        >
          {editor.type === 'checkbox' ? (
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
    <CellFrame cell={cell} errorId={errorId}>
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
    <CellFrame cell={cell} errorId={errorId}>
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
