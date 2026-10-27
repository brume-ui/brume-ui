import { type Static, Type } from '@sinclair/typebox';

export const ComponentRefSchema = Type.Object({
  type: Type.Literal('component'),
  name: Type.String(),
  props: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type ComponentRef = Static<typeof ComponentRefSchema>;
