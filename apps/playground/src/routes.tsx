import type { ComponentType } from 'react';
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
import { AppShellPage, CardPage, PageHeaderPage } from './pages/layout';
import { ConfirmPage, DialogPage, ToastPage } from './pages/overlays';

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
  { name: 'dialog', title: 'Dialog', Component: DialogPage },
  { name: 'confirm', title: 'useConfirm', Component: ConfirmPage },
  { name: 'toast', title: 'toast', Component: ToastPage },
  { name: 'data-table', title: 'DataTable', Component: DataTablePage },
  { name: 'pagination', title: 'Pagination', Component: PaginationPage },
  { name: 'empty-state', title: 'EmptyState', Component: EmptyStatePage },
  { name: 'skeleton', title: 'Skeleton', Component: SkeletonPage },
  { name: 'app-shell', title: 'AppShell parts', Component: AppShellPage },
  { name: 'page-header', title: 'PageHeader', Component: PageHeaderPage },
  { name: 'card', title: 'Card', Component: CardPage },
  { name: 'fonts', title: 'Fonts (中文字體比較)', Component: FontsPage },
];

export const INDEX_ENTRIES: Array<{ name: string; title: string }> = [
  ...ROUTES,
  { name: SHELL_ROUTE, title: 'Shell (AppShell + ListPageView)' },
];
