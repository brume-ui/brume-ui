import { ActionBar, Button, useBrume } from '@brume-ui/brume-react';
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
      {/* The live region above announces the count; the label repeats it for sighted users. */}
      <ActionBar
        aria-label={t('grid.batchActions')}
        label={<span aria-hidden="true">{count}</span>}
      >
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
      </ActionBar>
    </>
  );
}
