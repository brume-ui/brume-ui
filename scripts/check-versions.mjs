// Asserts every publishable workspace package has the version named by the release tag.
// Usage: node scripts/check-versions.mjs v0.1.0-alpha.0   (defaults to $GITHUB_REF_NAME)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag?.startsWith('v')) {
  console.error(`Expected a tag like v1.2.3, got "${tag ?? ''}". Pass it as the first argument.`);
  process.exit(1);
}
const expected = tag.slice(1);

const packages = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => JSON.parse(readFileSync(join('packages', entry.name, 'package.json'), 'utf8')))
  .filter((pkg) => !pkg.private);

if (packages.length === 0) {
  console.error('No publishable packages found under packages/.');
  process.exit(1);
}

const mismatched = packages.filter((pkg) => pkg.version !== expected);
for (const pkg of packages) {
  console.log(`${pkg.version === expected ? 'ok  ' : 'FAIL'} ${pkg.name}@${pkg.version}`);
}
if (mismatched.length > 0) {
  console.error(
    `${mismatched.length} package(s) do not match tag ${tag}. Set their "version" to ${expected} and re-tag.`,
  );
  process.exit(1);
}
console.log(`All ${packages.length} packages match ${tag}.`);
