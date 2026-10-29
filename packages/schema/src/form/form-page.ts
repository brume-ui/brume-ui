import { type Static, Type } from '@sinclair/typebox';
import { IdSchema } from '../protocol/http';
import { FormDefSchema } from './layout';

export const AfterSaveSchema = Type.Union([
  Type.Literal('list'),
  Type.Literal('edit'),
  Type.Literal('create'),
  Type.Literal('view'),
]);
export type AfterSave = Static<typeof AfterSaveSchema>;

export const FormPageSchema = Type.Object({
  type: Type.Literal('form'),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  formId: Type.String(),
  /** 資源的顯示名稱，例如「訂單」 */
  name: Type.String(),
  mode: Type.Union([Type.Literal('create'), Type.Literal('edit')]),
  record: Type.Optional(
    Type.Object({
      id: IdSchema,
      label: Type.Optional(Type.String()),
    }),
  ),
  form: FormDefSchema,
  values: Type.Record(Type.String(), Type.Unknown()),
  submit: Type.Object({
    method: Type.Union([Type.Literal('post'), Type.Literal('put')]),
    url: Type.String(),
    label: Type.String(),
  }),
  after: Type.Object({ options: Type.Array(AfterSaveSchema), default: AfterSaveSchema }),
  presentation: Type.Union([Type.Literal('modal'), Type.Literal('page')]),
  size: Type.Union([Type.Literal('sm'), Type.Literal('md'), Type.Literal('lg')]),
  listUrl: Type.Optional(Type.String()),
  uploadUrl: Type.Optional(Type.String()),
});
export type FormPage = Static<typeof FormPageSchema>;
