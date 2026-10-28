# brume-ui

Brume admin-panel UI kit (pnpm monorepo).

| Package                    | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `@brume-ui/brume-tokens`   | Design tokens (CSS variables `--br-*`)                           |
| `@brume-ui/brume-react`    | React components (charts: [CHARTS.md](packages/react/CHARTS.md)) |
| `@brume-ui/brume-schema`   | Page schema (TypeBox)                                            |
| `@brume-ui/brume-renderer` | Schema renderer                                                  |
| `@brume-ui/brume-inertia`  | Inertia adapter                                                  |

## Commands

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

Packages are published to npmjs.com under the `@brume-ui` scope (dist-tag `alpha` for prereleases),
by `.github/workflows/release.yml` on a `v*` tag push, using npm trusted publishing with provenance.
