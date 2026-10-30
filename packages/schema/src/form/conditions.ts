import { type Static, Type } from '@sinclair/typebox';

/** No parent traversal or prototype segments. Wildcards belong only to exclusion/template paths. */
const segment =
  '(?!(?:__proto__|prototype|constructor)(?:\\.|$))(?:[A-Za-z_$][A-Za-z0-9_$-]*|[0-9]+)';
export const ScalarPathSchema = Type.String({ pattern: `^${segment}(?:\\.${segment})*$` });
export const TemplatePathSchema = Type.String({
  pattern: `^${segment}(?:\\.(?:${segment}|\\*))*$`,
});
export const JsonPrimitiveSchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
]);
export type JsonPrimitive = Static<typeof JsonPrimitiveSchema>;

export const ConditionPathSchema = Type.Object(
  {
    scope: Type.Union([Type.Literal('root'), Type.Literal('row')]),
    path: ScalarPathSchema,
  },
  { additionalProperties: false },
);
export type ConditionPath = Static<typeof ConditionPathSchema>;

export const ExclusionPathSchema = Type.Object(
  {
    scope: Type.Union([Type.Literal('root'), Type.Literal('row')]),
    path: TemplatePathSchema,
  },
  { additionalProperties: false },
);
export type ExclusionPath = Static<typeof ExclusionPathSchema>;

export const ConditionSchema = Type.Recursive(
  (This) =>
    Type.Union([
      Type.Object(
        {
          op: Type.Union([Type.Literal('eq'), Type.Literal('ne')]),
          field: ConditionPathSchema,
          value: JsonPrimitiveSchema,
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          op: Type.Literal('in'),
          field: ConditionPathSchema,
          values: Type.Array(JsonPrimitiveSchema),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { op: Type.Literal('empty'), field: ConditionPathSchema },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          op: Type.Union([Type.Literal('all'), Type.Literal('any')]),
          conditions: Type.Array(This),
        },
        { additionalProperties: false },
      ),
      Type.Object({ op: Type.Literal('not'), condition: This }, { additionalProperties: false }),
    ]),
  { $id: 'Condition' },
);
export type Condition = Static<typeof ConditionSchema>;

export const RemoteOptionsSchema = Type.Object(
  {
    url: Type.String(),
    dependsOn: Type.Optional(Type.Record(Type.String(), ConditionPathSchema)),
  },
  { additionalProperties: false },
);
export type RemoteOptions = Static<typeof RemoteOptionsSchema>;
