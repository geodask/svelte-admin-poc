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

Package names are provisional. Every dependency is pinned to an exact version in the `catalog` of the root `package.json`, and members refer to it with `catalog:`, so each upgrade is one deliberate change in one place.

## Getting started

You need Node 22 (see `.node-version`) and Bun (see `packageManager` in `package.json`).

```sh
bun install
bun run --filter @svelte-admin/demo backend   # the demo backend on http://localhost:4100
bun run dev                                    # the demo app; open http://localhost:5173/admin/recipes
```

The demo backend (`apps/demo/backend`) is a small Bun server that serves seed data from memory. Restart it, or `POST /reset`, to restore the seed data.

| Script                        | What it runs                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `bun run check`               | Type checks every workspace member (svelte-check, or `tsc` in the core)          |
| `bun run lint`                | ESLint and Prettier                                                              |
| `bun run format`              | Prettier, writing fixes                                                          |
| `bun run test:unit`           | Vitest in the core                                                               |
| `bun run test:e2e`            | Playwright against a production build of the demo, with JavaScript on and off    |
| `bun run check:client-bundle` | After `bun run build`: fails if server-only code reached the demo's client build |

CI (`.github/workflows/ci.yml`) runs check, lint, unit, the client bundle check and e2e on every push and pull request.

## Wiring a Resource

Each Resource costs about 4 lines of wiring in the demo:

1. A shared module with its schema: `src/lib/resources/recipes.ts` calls `defineResource`.
2. A one-line remote module: `src/lib/resources/recipes.remote.ts` exports `serveResource(recipes, api.for(recipes))`.
3. One entry in `src/lib/admin.ts`, which `src/params.ts` also reads for the Resource param matcher.

`@svelte-admin/core` is the browser-safe entry. `serveResource` lives in `@svelte-admin/core/server` and the bundled REST Provider in `@svelte-admin/core/rest`; import those only from `.remote.ts` files and server-only modules.
