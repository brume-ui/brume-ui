import { type Static, Type } from '@sinclair/typebox';
import { TemplatePathSchema } from './conditions';

/** Stable UI identity. An id is a scoped relation record hint, never authorization. */
export const RowIdentitySchema = Type.Object(
  {
    key: Type.String({ minLength: 1 }),
    id: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
export type RowIdentity = Static<typeof RowIdentitySchema>;

/** Ordered outer-to-inner row chain, independent of numeric error paths. */
export const RowContextSchema = Type.Array(
  Type.Object(
    {
      path: TemplatePathSchema,
      ...RowIdentitySchema.properties,
    },
    { additionalProperties: false },
  ),
);
export type RowContext = Static<typeof RowContextSchema>;

/** Selectable identity plus flattened declared extras; never an intermediary child id. */
export const RelationItemSchema = Type.Intersect([
  Type.Object({ id: Type.String({ minLength: 1 }) }),
  Type.Record(Type.String(), Type.Unknown()),
]);
export type RelationItem = Static<typeof RelationItemSchema>;
export const RelationValueSchema = Type.Union([
  Type.Null(),
  RelationItemSchema,
  Type.Array(RelationItemSchema),
]);
export type RelationValue = Static<typeof RelationValueSchema>;
