import { mkdirSync, writeFileSync } from 'node:fs';
import { buildThemeCss, buildTokensCss, buildTokensJson } from '../dist/index.js';

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/tokens.css', import.meta.url), buildTokensCss());
writeFileSync(new URL('../dist/theme.css', import.meta.url), buildThemeCss());
writeFileSync(new URL('../dist/tokens.json', import.meta.url), buildTokensJson());
