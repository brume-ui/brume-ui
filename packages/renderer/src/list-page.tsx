import type { ListPage } from '@brume-ui/brume-schema';
import { GridView } from './grid/grid-view';

export { hrefForPage } from './grid/use-grid-navigation';

export const ListPageView = ({ page }: { page: ListPage }) => <GridView page={page} />;
