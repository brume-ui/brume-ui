import { PillRadioGroup, useBrume } from '@brume-ui/brume-react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';

/** Pills on the toolbar's left: 「全部」 (no `scope`) first, then the page's scopes. */
export function GridScopes() {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate } = useGridNavigation();
  const scopes = page.scopes ?? [];
  if (scopes.length === 0) return null;
  return (
    <PillRadioGroup
      label={t('grid.scope')}
      options={[
        { value: '', label: t('grid.scopeAll') },
        ...scopes.map((s) => ({ value: s.key, label: s.label })),
      ]}
      value={page.query.scope ?? ''}
      onChange={(scope) => navigate({ scope: scope || undefined })}
    />
  );
}
