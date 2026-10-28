import { type Static, Type } from '@sinclair/typebox';

export const ErrorPageSchema = Type.Object({
  type: Type.Literal('error'),
  status: Type.Integer(),
  title: Type.String(),
  message: Type.String(),
  action: Type.Optional(Type.Object({ label: Type.String(), url: Type.String() })),
});
export type ErrorPage = Static<typeof ErrorPageSchema>;
