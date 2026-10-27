import { PageEnvelopeSchema } from './page';
import { SharedPropsSchema } from './shared';

/** v0.json 的內容：根為 PageEnvelope，`$defs` 收錄 PageEnvelope 與 SharedProps。 */
export function emitJsonSchema(): string {
  const doc = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://brume.dev/schema/v0.json',
    $ref: '#/$defs/PageEnvelope',
    $defs: {
      PageEnvelope: PageEnvelopeSchema,
      SharedProps: SharedPropsSchema,
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
