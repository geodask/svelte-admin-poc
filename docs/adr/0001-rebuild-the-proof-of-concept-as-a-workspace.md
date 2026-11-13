---
status: accepted
---

# Rebuild the proof of concept as a bun workspace in this repo

The proof of concept proved the core promise (one Zod schema per Resource, plus a Provider, gives a type-safe CRUD admin in SvelteKit), but the direction review replaced every one of its modules. It decided to delete the Vite plugin and its generated files, to rewrite the Provider contract, forms and the Field registry, to split a headless core from a Theme package, and to ship as a library. Its ~2,400 project lines also sit beside ~9,900 lines of vendored shadcn, have no tests, and are on SvelteKit 2.51, while the Kit 3.2 upgrade touches every file. So we rebuild instead of evolving it in place: this repo becomes a bun workspace (`packages/core`, `packages/theme-shadcn`, `apps/demo`) on SvelteKit 3.2 and Svelte 5.57 with exact pins. The proof of concept is tagged `poc-final` and deleted. Only a short carry-over list is copied across on purpose: `export.ts` (with a formula-injection guard), the `z.registry` mechanism, the TanStack table wiring, the error page, the sidebar grouping, and the query/command wrapping that seeds `serveResource`.

## Considered Options

- **Keep and evolve in place.** Rejected: with every module already replaced, evolving would mean rewriting each file under the old layout and a Kit 2 → 3 migration, with no tests to catch regressions.
- **Rebuild in a new repo.** Rejected: it would split the history, the Linear trail and the prototype branches from the code, for no gain.

## Consequences

- `apps/demo`, with recipes, users and posts against a local REST backend, stands in as the success test until a real app adopts the framework: 3+ Resources at about 4 lines of wiring each.
- Remote functions and async Svelte are still experimental. They stay behind the core's own helpers, version bumps are deliberate, and nothing is published to npm until they are stable.
- The build follows the milestone change list in the resolution of the Linear verdict ticket (PER-14), not the order the proof of concept was written in.
