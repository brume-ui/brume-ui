export { type ComponentRef, ComponentRefSchema } from './component-ref';
export {
  type DashboardBlock,
  DashboardBlockSchema,
  type DashboardPage,
  DashboardPageSchema,
} from './dashboard';
export { emitJsonSchema } from './json-schema';
export { type ListColumn, ListColumnSchema, type ListPage, ListPageSchema } from './list';
export {
  type BrumePage,
  BrumePageSchema,
  type PageEnvelope,
  PageEnvelopeSchema,
  type ValidationResult,
  validateEnvelope,
} from './page';
export {
  type Flash,
  FlashSchema,
  type LayoutSettings,
  LayoutSettingsSchema,
  type Locale,
  LocaleSchema,
  type MenuItem,
  MenuItemSchema,
  type SharedProps,
  SharedPropsSchema,
} from './shared';
export { SCHEMA_VERSION } from './version';
