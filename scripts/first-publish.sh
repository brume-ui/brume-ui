#!/usr/bin/env bash
# ONE-TIME manual first publish of the @brume-ui/* packages.
# A package must exist on npmjs.com before a trusted publisher can be configured for it;
# after that, .github/workflows/release.yml publishes on tag push.
#
# Usage: npm login first, then
#   scripts/first-publish.sh [--otp=123456]    # extra args go to `npm publish`
#   DRY_RUN=1 scripts/first-publish.sh         # verify tarballs without publishing
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./packages/tokens/package.json').version")
dist_tag=latest
if [[ "$version" == *-* ]]; then
  prerelease="${version#*-}"
  dist_tag="${prerelease%%.*}"
fi

pnpm install --frozen-lockfile
pnpm build

out=$(mktemp -d)
for dir in packages/*/; do
  pnpm --dir "$dir" pack --pack-destination "$out"
done

for tgz in "$out"/*.tgz; do
  if tar -xOf "$tgz" package/package.json | grep -q 'workspace:'; then
    echo "workspace: protocol left in $tgz" >&2
    exit 1
  fi
done

# publishConfig.provenance is for CI; a local publish has no OIDC provider to attest with
flags=(--access public --tag "$dist_tag" --provenance=false)
[[ -n "${DRY_RUN:-}" ]] && flags+=(--dry-run)
for tgz in "$out"/*.tgz; do
  echo "== $(basename "$tgz")"
  npm publish "$tgz" "${flags[@]}" "$@"
done
