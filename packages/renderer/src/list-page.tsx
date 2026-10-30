import type { ListPage } from '@brume-ui/brume-schema';
import { GridView } from './grid/grid-view';
import { ResourceGridView } from './grid/resource/resource-grid';

export { hrefForPage } from './grid/use-grid-navigation';

export const ListPageView = ({ page }: { page: ListPage }) =>
  page.resource || page.quickCreate ? (
    <ResourceGridView key={page.gridId} page={page} />
  ) : (
    <GridView page={page} />
  );
