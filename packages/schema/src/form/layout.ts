import { type Static, type TSchema, Type } from '@sinclair/typebox';
import { type FieldDef, FieldDefSchema, GridWidthSchema } from './field';

export type FieldNode = { type: 'field'; field: FieldDef };

/** 表單的版型樹。欄位的值以 `field.name` 為鍵，`embeds` 底下的值是 `name` 底下的物件。 */
export type FormNode =
  | FieldNode
  | { type: 'section'; key: string; title: string; description?: string; children: FormNode[] }
  /** 欄位以 `field.width`（1–12）分配 */
  | { type: 'row'; children: FieldNode[] }
  | { type: 'columns'; columns: Array<{ /** 1–12 */ width: number; children: FormNode[] }> }
  /** 卡片 */
  | { type: 'block'; title?: string; children: FormNode[] }
  | { type: 'divider'; label?: string }
  /** 值是 `name` 底下的物件 */
  | { type: 'embeds'; name: string; label: string; children: FormNode[] };

const FieldNodeSchema = Type.Object({ type: Type.Literal('field'), field: FieldDefSchema });

/** 遞迴用 `$id` 表示，輸出到 v0.json 時是 `#/$defs/FormNode`。 */
export const FormNodeSchema = Type.Recursive(
  (This) =>
    Type.Union([
      FieldNodeSchema,
      Type.Object({
        type: Type.Literal('section'),
        key: Type.String(),
        title: Type.String(),
        description: Type.Optional(Type.String()),
        children: Type.Array(This),
      }),
      Type.Object({ type: Type.Literal('row'), children: Type.Array(FieldNodeSchema) }),
      Type.Object({
        type: Type.Literal('columns'),
        columns: Type.Array(Type.Object({ width: GridWidthSchema, children: Type.Array(This) })),
      }),
      Type.Object({
        type: Type.Literal('block'),
        title: Type.Optional(Type.String()),
        children: Type.Array(This),
      }),
      Type.Object({ type: Type.Literal('divider'), label: Type.Optional(Type.String()) }),
      Type.Object({
        type: Type.Literal('embeds'),
        name: Type.String(),
        label: Type.String(),
        children: Type.Array(This),
      }),
    ]),
  { $id: 'FormNode' },
) as unknown as TSchema & { static: FormNode };

export const FormDefSchema = Type.Object({
  layout: Type.Union([Type.Literal('stacked'), Type.Literal('horizontal')]),
  nodes: Type.Array(FormNodeSchema),
  /** 彈窗內頂層 section 的呈現 */
  sections: Type.Optional(Type.Union([Type.Literal('stack'), Type.Literal('tabs')])),
});
export type FormDef = Static<typeof FormDefSchema>;
