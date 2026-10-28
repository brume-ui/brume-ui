import { Button, Card, Field, useBrume } from '@brume-ui/brume-react';
import type { FilterDef, FilterPanel, FilterValue } from '@brume-ui/brume-schema';
import { ListFilter } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import { FilterInputControl, withFilter } from './filter-input';

interface PlacedFilter {
  def: FilterDef;
  /** 1-based grid line positions. */
  row: number;
  column: number;
  span: number;
}

/**
 * Places the panel's filters on a `columns`-wide grid: items flow left to right, `newline` starts
 * a new row, `span: 2` takes two columns (wrapping first if they do not fit). Only `panel` filters.
 */
export function placeFilters(panel: FilterPanel): PlacedFilter[] {
  const placed: PlacedFilter[] = [];
  let row = 1;
  let column = 1;
  for (const item of panel.items) {
    if (!('key' in item)) {
      if (column > 1) {
        row += 1;
        column = 1;
      }
      continue;
    }
    if (item.placement !== 'panel') continue;
    const span = Math.min(item.span ?? 1, panel.columns);
    if (column + span - 1 > panel.columns) {
      row += 1;
      column = 1;
    }
    placed.push({ def: item, row, column, span });
    column += span;
  }
  return placed;
}

/** Inputs that are a group of controls: Field names them with aria-labelledby, not a label. */
const GROUP_INPUTS: ReadonlySet<FilterDef['input']['type']> = new Set([
  'radio',
  'checkbox',
  'range',
]);

function panelFilters(panel: FilterPanel | undefined): FilterDef[] {
  return panel ? placeFilters(panel).map((p) => p.def) : [];
}

export interface FilterPanelToggleProps {
  open: boolean;
  onToggle(): void;
  /** The panel's id, for `aria-controls`. */
  panelId: string;
}

/** 「篩選」 with the number of applied panel filters in the accent colour. */
export function FilterPanelToggle({ open, onToggle, panelId }: FilterPanelToggleProps) {
  const { page } = useGrid();
  const { t } = useBrume();
  const defs = panelFilters(page.filters);
  if (defs.length === 0) return null;
  const keys = new Set(defs.map((d) => d.key));
  const count = page.appliedFilters.filter((a) => keys.has(a.key)).length;
  return (
    <Button
      variant="secondary"
      iconStart={ListFilter}
      count={count}
      countLabel={t('grid.filterCount', { count })}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
    >
      {t('grid.filter')}
    </Button>
  );
}

function pickFilters(
  filters: Record<string, FilterValue>,
  defs: FilterDef[],
): Record<string, FilterValue> {
  const picked: Record<string, FilterValue> = {};
  for (const def of defs) {
    const value = filters[def.key];
    if (value !== undefined) picked[def.key] = value;
  }
  return picked;
}

export interface FilterPanelViewProps {
  id: string;
  open: boolean;
}

/**
 * The panel under the toolbar (inline, not a dialog). Edits stay in a draft until 「套用篩選」;
 * 「重設」 empties the draft. Filters outside the panel (column, hidden) are kept as they are.
 */
export function FilterPanelView({ id, open }: FilterPanelViewProps) {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate } = useGridNavigation();
  const applied = page.query.filters;
  const placed = page.filters ? placeFilters(page.filters) : [];
  const defs = placed.map((p) => p.def);

  const [draft, setDraft] = useState(() => pickFilters(applied, defs));
  // Bumped by 「重設」 so the inputs start over, including state they keep themselves (the
  // operator picked in a condition filter before its value).
  const [generation, setGeneration] = useState(0);
  // Applied filters that change (by content: every server answer brings new objects) start the
  // draft again; sorting, paging or a refresh keep what is being typed.
  const appliedKey = JSON.stringify(applied);
  const [draftFor, setDraftFor] = useState(appliedKey);
  if (draftFor !== appliedKey) {
    setDraftFor(appliedKey);
    setDraft(pickFilters(applied, defs));
  }

  if (!page.filters || placed.length === 0) return null;

  const apply = () => {
    const keys = new Set(defs.map((d) => d.key));
    const next = pickFilters(draft, defs);
    for (const [key, value] of Object.entries(applied)) if (!keys.has(key)) next[key] = value;
    navigate({ filters: next });
  };

  return (
    <section id={id} hidden={!open} aria-label={t('grid.filter')}>
      {/* The inputs mount only while open, so a closed panel asks for no remote labels. */}
      {open ? (
        <Card>
          <form
            className="br:flex br:flex-col br:gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            <div
              className="br:grid br:gap-4 br:max-sm:grid-cols-1 br:sm:grid-cols-[repeat(var(--br-filter-columns),minmax(0,1fr))]"
              style={{ '--br-filter-columns': String(page.filters.columns) } as CSSProperties}
            >
              {placed.map(({ def, row, column, span }) => (
                <div
                  key={`${def.key}-${generation}`}
                  data-filter-item=""
                  // One column on phones: the explicit placement only applies from `sm` up.
                  className="br:min-w-0 br:max-sm:[grid-row:auto]! br:max-sm:[grid-column:auto]!"
                  style={{ gridRow: String(row), gridColumn: `${column} / span ${span}` }}
                >
                  <Field label={def.label} group={GROUP_INPUTS.has(def.input.type)}>
                    <FilterInputControl
                      def={def}
                      value={draft[def.key]}
                      onChange={(value) => setDraft((prev) => withFilter(prev, def.key, value))}
                    />
                  </Field>
                </div>
              ))}
            </div>
            <div className="br:flex br:flex-wrap br:justify-end br:gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft({});
                  setGeneration((g) => g + 1);
                }}
              >
                {t('grid.resetFilters')}
              </Button>
              <Button type="submit">{t('grid.applyFilters')}</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
