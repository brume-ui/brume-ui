import { Button, useBrume } from '@brume-ui/brume-react';
import { useGrid } from '../grid-context';
import { useActionRunner } from './run-action';

/**
 * Shown above the toolbar while rows are selected: the count, each batch action and 「取消選取」.
 * A batch action that ran clears the selection; a failed one keeps it for another try.
 */
export function BatchBar() {
  const { page, selection, setSelection } = useGrid();
  const { t } = useBrume();
  const { run, isRunning } = useActionRunner();
  const ids = page.rows.filter((row) => selection.has(String(row.id))).map((row) => row.id);
  const count = ids.length > 0 ? t('grid.selectedCount', { count: ids.length }) : '';
  // Mounted before the first selection, so 「已選取 1 筆」 is announced too.
  const live = (
    <p aria-live="polite" className="br:sr-only">
      {count}
    </p>
  );
  if (ids.length === 0) return live;
  const actions = run ? page.actions.batch : [];
  return (
    <>
      {live}
      <section
        aria-label={t('grid.batchActions')}
        className="br:flex br:flex-wrap br:items-center br:gap-2 br:rounded-card br:bg-surface br:px-4 br:py-2 br:shadow-row"
      >
        <p aria-hidden="true" className="br:mr-2 br:text-sm br:font-semibold br:text-text">
          {count}
        </p>
        {actions.map((def) => (
          <Button
            key={def.key}
            variant={def.tone === 'danger' ? 'danger' : 'secondary'}
            size="sm"
            loading={isRunning(def, 'batch', ids)}
            onClick={async () => {
              if (await run?.(def, 'batch', ids)) setSelection(new Set());
            }}
          >
            {def.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
          {t('grid.clearSelection')}
        </Button>
      </section>
    </>
  );
}
