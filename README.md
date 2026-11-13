# Svelte Admin

An admin framework for SvelteKit: describe each Resource with one Zod schema and a Provider, and get the screens to list, view, create, edit and delete its records.

The project is being rebuilt as a bun workspace (`packages/core`, `packages/theme-shadcn`, `apps/demo`). See [ADR 0001](docs/adr/0001-rebuild-the-proof-of-concept-as-a-workspace.md) for why, and [`CONTEXT.md`](CONTEXT.md) for the domain language.

The original proof of concept is preserved at the `poc-final` tag. The rebuild copies only a short carry-over list from it on purpose.

## Workspace

| Member                       | Path                    | What it is                                                                                 |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `@svelte-admin/core`         | `packages/core`         | The headless core. Peer-depends on `@sveltejs/kit` and `svelte`, depends on no UI package. |
| `@svelte-admin/theme-shadcn` | `packages/theme-shadcn` | The shadcn Theme. Depends on the core.                                                     |
| `@svelte-admin/demo`         | `apps/demo`             | The demo app (`adapter-node`). The admin lives under `/admin`.                             |

Package names are provisional. Every dependency is pinned to an exact version, so each upgrade is a deliberate change.

## Getting started

You need Node 22 (see `.node-version`) and Bun (see `packageManager` in `package.json`).

```sh
bun install
bun run dev        # the demo app; open http://localhost:5173/admin
```

| Script              | What it runs                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `bun run check`     | Type checks every workspace member (svelte-check, or `tsc` in the core)       |
| `bun run lint`      | ESLint and Prettier                                                           |
| `bun run format`    | Prettier, writing fixes                                                       |
| `bun run test:unit` | Vitest in the core                                                            |
| `bun run test:e2e`  | Playwright against a production build of the demo, with JavaScript on and off |

CI (`.github/workflows/ci.yml`) runs check, lint, unit and e2e on every push and pull request.
