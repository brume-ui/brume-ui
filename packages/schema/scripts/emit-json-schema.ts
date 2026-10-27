import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emitJsonSchema } from '../src/json-schema';

const out = fileURLToPath(new URL('../schema/v0.json', import.meta.url));
writeFileSync(out, emitJsonSchema());
console.log(`wrote ${out}`);
