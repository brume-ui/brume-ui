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
import { DemoCatalogPage } from './pages/demo-catalog';
import { FontsPage } from './pages/fonts';
import {
  FormDialogPage,
  FormHorizontalPage,
  FormStackedPage,
  FormStandalonePage,
} from './pages/form';
import { FormBehaviorsPage } from './pages/form-behaviors';
import { FormCompositionPage } from './pages/form-composition';
import { FormConditionsPage } from './pages/form-conditions';
import { FormFieldsPage } from './pages/form-fields';
import { FormLayoutsPage } from './pages/form-layouts';
import { FormRelationsPage } from './pages/form-relations';
import { FormRepeatersPage } from './pages/form-repeaters';
import { ErrorPagePage, GridEmptyPage, GridPage } from './pages/grid';
import { GridFeaturesPage } from './pages/grid-features';
import { InputsPage } from './pages/inputs';
import { AppShellPage, CardPage, PageHeaderPage } from './pages/layout';
import { MotionPage } from './pages/motion';
import { ConfirmPage, DialogPage, MenusPage, ToastPage } from './pages/overlays';
import { PublicContractsPage } from './pages/public-contracts';

export interface Route {
  name: string;
  title: string;
  Component: ComponentType;
  /** The page renders its own guide, including any selected example. */
  ownsGuide?: boolean;
}

/** `/#/shell` is rendered by the app itself (it needs the locale handler). */
export const SHELL_ROUTE = 'shell';

export const ROUTES: Route[] = [
  {
    name: 'public-contracts',
    title: '公開元件與契約',
    Component: PublicContractsPage,
    ownsGuide: true,
  },
  { name: 'demos', title: '功能示範目錄', Component: DemoCatalogPage },
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
  { name: 'form-fields', title: '表單 · 欄位聚焦', Component: FormFieldsPage, ownsGuide: true },
  { name: 'form-layouts', title: '表單 · 版型聚焦', Component: FormLayoutsPage, ownsGuide: true },
  {
    name: 'form-behaviors',
    title: '表單 · 行為聚焦',
    Component: FormBehaviorsPage,
    ownsGuide: true,
  },
  { name: 'form', title: '表單 · 標籤在上', Component: FormStackedPage },
  { name: 'form-horizontal', title: '表單 · 標籤在左', Component: FormHorizontalPage },
  { name: 'form-page', title: '表單 · 獨立頁面', Component: FormStandalonePage },
  {
    name: 'form-conditions',
    title: '表單 · 條件式贈品設定',
    Component: FormConditionsPage,
    ownsGuide: true,
  },
  {
    name: 'form-composition',
    title: '表單 · 關聯組合驗收',
    Component: FormCompositionPage,
    ownsGuide: true,
  },
  { name: 'form-repeaters', title: '表單 · 巢狀重複列', Component: FormRepeatersPage },
  { name: 'form-relations', title: '表單 · 遠端選項與互斥', Component: FormRelationsPage },
  { name: 'form-dialog', title: '表單 · 彈窗', Component: FormDialogPage },
  { name: 'grid-features', title: 'Grid · 功能聚焦', Component: GridFeaturesPage, ownsGuide: true },
  { name: 'grid', title: 'Grid（訂單）', Component: GridPage, ownsGuide: true },
  { name: 'grid-empty', title: 'Grid（空）', Component: GridEmptyPage, ownsGuide: true },
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
