import type { ComponentType } from 'react';
import { ChartsPage, DashboardPage } from './pages/charts';
import {
  ButtonPage,
  CheckboxPage,
  FieldPage,
  IconButtonPage,
  PasswordInputPage,
  SelectPage,
  TextInputPage,
} from './pages/controls';
import { DataTablePage, EmptyStatePage, PaginationPage, SkeletonPage } from './pages/data';
import { FontsPage } from './pages/fonts';
import {
  FormDialogPage,
  FormHorizontalPage,
  FormStackedPage,
  FormStandalonePage,
} from './pages/form';
import { ErrorPagePage, GridEmptyPage, GridPage } from './pages/grid';
import { InputsPage } from './pages/inputs';
import { AppShellPage, CardPage, PageHeaderPage } from './pages/layout';
import { MotionPage } from './pages/motion';
import { ConfirmPage, DialogPage, MenusPage, ToastPage } from './pages/overlays';

export interface Route {
  name: string;
  title: string;
  Component: ComponentType;
}

/** `/#/shell` is rendered by the app itself (it needs the locale handler). */
export const SHELL_ROUTE = 'shell';

export const ROUTES: Route[] = [
  { name: 'button', title: 'Button', Component: ButtonPage },
  { name: 'icon-button', title: 'IconButton', Component: IconButtonPage },
  { name: 'text-input', title: 'TextInput', Component: TextInputPage },
  { name: 'password-input', title: 'PasswordInput', Component: PasswordInputPage },
  { name: 'field', title: 'Field', Component: FieldPage },
  { name: 'select', title: 'Select', Component: SelectPage },
  { name: 'checkbox', title: 'Checkbox', Component: CheckboxPage },
  { name: 'inputs', title: 'Inputs', Component: InputsPage },
  { name: 'dialog', title: 'Dialog', Component: DialogPage },
  { name: 'confirm', title: 'useConfirm', Component: ConfirmPage },
  { name: 'toast', title: 'toast', Component: ToastPage },
  { name: 'menus', title: 'Menus', Component: MenusPage },
  { name: 'data-table', title: 'DataTable', Component: DataTablePage },
  { name: 'pagination', title: 'Pagination', Component: PaginationPage },
  { name: 'empty-state', title: 'EmptyState', Component: EmptyStatePage },
  { name: 'skeleton', title: 'Skeleton', Component: SkeletonPage },
  { name: 'form', title: '表單 · 標籤在上', Component: FormStackedPage },
  { name: 'form-horizontal', title: '表單 · 標籤在左', Component: FormHorizontalPage },
  { name: 'form-page', title: '表單 · 獨立頁面', Component: FormStandalonePage },
  { name: 'form-dialog', title: '表單 · 彈窗', Component: FormDialogPage },
  { name: 'grid', title: 'Grid（訂單）', Component: GridPage },
  { name: 'grid-empty', title: 'Grid（空）', Component: GridEmptyPage },
  { name: 'error-page', title: '錯誤頁', Component: ErrorPagePage },
  { name: 'app-shell', title: 'AppShell parts', Component: AppShellPage },
  { name: 'page-header', title: 'PageHeader', Component: PageHeaderPage },
  { name: 'card', title: 'Card', Component: CardPage },
  { name: 'fonts', title: 'Fonts (中文字體比較)', Component: FontsPage },
  { name: 'motion', title: '動效', Component: MotionPage },
  { name: 'charts', title: '圖表', Component: ChartsPage },
  { name: 'dashboard', title: '儀表板範例', Component: DashboardPage },
];

export const INDEX_ENTRIES: Array<{ name: string; title: string }> = [
  ...ROUTES,
  { name: SHELL_ROUTE, title: 'Shell (AppShell + ListPageView)' },
];
