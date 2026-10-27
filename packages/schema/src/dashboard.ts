import { type Static, Type } from '@sinclair/typebox';
import { ComponentRefSchema } from './component-ref';

export const DashboardBlockSchema = Type.Union([
  Type.Object({ type: Type.Literal('card'), title: Type.String(), body: Type.String() }),
  ComponentRefSchema,
]);
export type DashboardBlock = Static<typeof DashboardBlockSchema>;

export const DashboardPageSchema = Type.Object({
  type: Type.Literal('dashboard'),
  title: Type.String(),
  blocks: Type.Array(DashboardBlockSchema),
});
export type DashboardPage = Static<typeof DashboardPageSchema>;
