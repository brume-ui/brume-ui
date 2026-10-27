import { type Static, Type } from '@sinclair/typebox';
import { ComponentRefSchema } from './component-ref';

export const ListColumnSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  numeric: Type.Optional(Type.Boolean()),
  display: Type.Optional(
    Type.Union([Type.Object({ type: Type.Literal('text') }), ComponentRefSchema]),
  ),
});
export type ListColumn = Static<typeof ListColumnSchema>;

export const ListPageSchema = Type.Object({
  type: Type.Literal('list'),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  columns: Type.Array(ListColumnSchema),
  rows: Type.Array(
    Type.Intersect([
      Type.Object({ id: Type.Union([Type.String(), Type.Number()]) }),
      Type.Record(Type.String(), Type.Unknown()),
    ]),
  ),
  pagination: Type.Object({
    page: Type.Integer(),
    perPage: Type.Integer(),
    total: Type.Integer(),
    lastPage: Type.Integer(),
  }),
});
export type ListPage = Static<typeof ListPageSchema>;
