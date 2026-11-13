# State of remote functions and async Svelte (November 2026)

Research for [PER-8](https://linear.app/geodask/issue/PER-8/state-of-remote-functions-and-async-svelte), part of the Svelte Admin direction review (PER-6). Checked 2026-11-13.

**Question:** How stable are SvelteKit remote functions and async Svelte, what is the full API, and what are the recommended patterns? What does that mean for this Admin framework, which builds each Resource's data operations as remote functions?

## TL;DR

- **Both features are still experimental.** No release has stabilised either one. SvelteKit 3.0 shipped on 2026-10-01. Its announcement answers "are remote functions ready yet?" with "Not quite. But it's our top priority!" It also says async Svelte "for now requires an experimental flag" [B3]. The latest release, SvelteKit 3.2.0 (2026-11-10), still needs `experimental.remoteFunctions` [C1, D1]. Svelte 5.57.3 still needs `compilerOptions.experimental.async`. The Svelte docs say that flag "will be removed in Svelte 6" [S1], and no Svelte 6 has been published [N2].
- **The API has kept changing, with breaking changes in minor releases.** Between this repo's pinned versions (Kit 2.51.0, Svelte 5.51.0) and the latest releases, these changed: client-requested refreshes (`.updates()`), the `requested()` server API, the validation-error hook, query caching keys, `.run()` (added, then removed), where types are exported from, and where config lives [C1, C2].
- **This repo's mutation pattern breaks on upgrade.** `resource-table-actions.svelte` calls `deleteOne(id).updates(getMany, getOne)`. Nothing on the server accepts that request. In 2.51 the server refreshed any query the client asked for. Since 2.56 the server must opt in with `requested(query, limit)`. Since 3.0, a request the server does not accept puts that query into an error state on the client [C1, D1, B4].
- **A production build fails at HEAD.** `vite build` fails because client code imports `$lib/resource`, and that module imports `$app/server` (reproduced below, see §9).
- **Recommended shape for an Admin framework:** reads use `query` (or `query.batch` to avoid n+1), read with `$derived(await …)` inside `<svelte:boundary>`. Writes use `form` where possible (it works without JavaScript) and `command` otherwise, refreshing on the server with `.refresh()`/`.set()`, or with `requested()` for queries the client asks for. Every argument is validated with a Standard Schema such as Zod. Authorisation is checked inside each remote function [D1].

## 1. Versions

| Package | This repo (`bun.lock`) | Latest (npm, 2026-11-13) |
|---|---|---|
| `@sveltejs/kit` | 2.51.0 (2026-02-12) | **3.2.0** (2026-11-10); 2.x line ends at 2.70.4 (`version-2` tag) |
| `svelte` | 5.51.0 (2026-02-13) | **5.57.3** (2026-10-26); no 6.x published |
| `@sveltejs/vite-plugin-svelte` | 6.2.4 | Kit 3 requires v7 |
| `vite` | 7.3.1 | Kit 3 requires `^8.0.12` |
| `zod` | 4.3.6 | (Standard Schema compliant) |

Sources: `package.json`, `bun.lock`, npm registry metadata [N1, N2], Kit 3.0.0 changelog [C1].

The repo enables both flags in `svelte.config.js` (`kit.experimental.remoteFunctions`, `compilerOptions.experimental.async`). In Kit 3, config must be passed to the Vite plugin in `vite.config.ts` instead [C1 "require Svelte config options to be passed through the Vite plugin"; D1; B3].

## 2. Stability signals

| Signal | Status | Source |
|---|---|---|
| Remote functions introduced | Kit 2.27, experimental | [D1] "Available since 2.27" |
| Original RFC | Discussion #13897, June 2025 (Announcements) | [G1] |
| Maintainer status, April 2026 | "focusing on ironing out all of the bugs and stabilizing the features"; docs overhaul "when we enter the RC phase" | [G1] |
| Kit 3 RC (2026-08-13) | "they remain behind an `experimental` flag as we iron out the last few kinks" | [B2] |
| Kit 3.0 stable (2026-10-01) | "Not quite. But it's our top priority!" Async Svelte "for now requires an experimental flag" | [B3] |
| Kit 3.0 changelog | Breaking: "disallow `*.remote.ts/js` files unless `experimental.remoteFunctions` is enabled" | [C1] #16247 |
| Current docs (Kit 3.2) | "This feature is currently experimental, meaning it is likely to contain bugs and is subject to change without notice" | [D1] |
| Svelte `await` docs | "currently experimental… The experimental flag will be removed in Svelte 6." Caveat: `await` and `$effect.pending()` "are subject to breaking changes outside of a semver major release" | [S1] |
| Open issues | ~111 open Kit issues match "remote functions" (2026-11-13), including correctness bugs (out-of-order responses #17354, `.current` eviction #17653, several `query.live` hangs) | [G2] |

**Verdict:** remote functions are experimental, but the team treats them as the main direction. They get frequent fixes, and the Kit 3 release posts present them as "our vision for how client-server communication should be handled" [B2]. No date for stabilisation has been announced. Expect more breaking changes in minor releases. Fewer are likely in the 3.x line, since 3.0 bundled most of the reworks.

## 3. Remote module rules (where they live, what they can export, who can import them)

- **File naming.** In 2.51, a remote module is a file ending in `.remote.ts`/`.remote.js` (it matches `.remote${ext}` for each `moduleExtensions` entry) [K251]. In Kit 3, any file whose name has a `remote` segment counts (regex `/[/.]remote\.[^/]+$/`, so both `remote.ts` and `data.remote.ts` match) [K320 `exports/vite/utils.js`; D1 Overview].
- **Location.** A remote module can live anywhere in `src` *except* a server-only location. In 2.51 that means `src/lib/server` [D251]. In Kit 3 it means any `server` directory, or a `server` segment in the filename, because nested server-only directories became a breaking change [C1 #15685, #16360; K320 build error `remote_module_server_only`].
- **Packages.** Third-party packages can ship remote modules if they list `@sveltejs/kit` in `peerDependencies` [D1; C1 #16492, #16426].
- **Exports.** Every export from a remote module must be a remote function (`query`/`form`/`command`/`prerender`). A `default` export is an error, and so is any other value, such as a Zod schema: "all exports from this file must be remote functions" [K320 `init_remote_functions`; K251]. The docs say this directly: "you cannot export a schema from a `.remote.ts` file", so shared schemas go in a separate module [D1 Validation].
- **Where the function is created.** The ID is assigned per *export* (`${hash}/${exportName}`) when the remote module is initialised [K320]. So a function built in another module (for example by a factory) and *re-exported* from a `.remote.ts` file is valid. This repo does exactly that: `defineResource` creates the functions and `src/resources.remote.ts` re-exports them. A remote function that is never exported from a remote module can still be called on the server, as in the docs' private `getUser` query, but the client cannot call it [D1 getRequestEvent].
- **Client and server.** Remote functions *run* on the server but can be *called* from anywhere. On the client, each export is replaced with a `fetch` wrapper around a generated endpoint [D1]. The server-only module guard still applies to everything else. Client code must not import `$app/server`, `$env/*/private` or `server/` modules except through a remote module [K251 guard plugin; K320 `plugins/guard.js`].
- **Types.** In Kit 3, the remote types (`RemoteQuery`, `RemoteQueryFunction`, `RemoteCommand`, `RemoteQueryUpdate`, …) moved from `@sveltejs/kit` to `$app/server` [C1 #16740, #16764].

## 4. API reference (Kit 3.2 docs, with 2.51 differences noted)

All of these are imported from `$app/server`. Arguments and return values are serialised with devalue, which supports `Date`, `Map` and custom transport types [D1].

### `query(schema?, fn)`

- Reads dynamic data. The result works as a Promise, so you can `await getPosts()` in markup, in `$derived`, or at the top level of a script. It also has `.loading`, `.error`, `.current` and `.ready` [D1; C2 2.58.0].
- **Caching and deduplication:** the cache key is the serialised argument. For `query`/`prerender` arguments, object, Map and Set keys are sorted, so `{limit, offset}` and `{offset, limit}` share one key (breaking in 2.56) [D1; C2 #15570]. On the server, the cache lasts for one request. On the client, `getPosts() === getPosts()` for as long as anything uses the query, and the entry is released when nothing does [D1].
- Since 2.61 a query can be awaited in *any* context (event handlers, module scope, callbacks) and dedupes with component subscribers. The short-lived `.run()` method (2.56–2.60) was removed [C2 #15779].
- **Not allowed when the whole page is prerendered** (`export const prerender = true`, `adapter-static`) [D1].
- `.refresh()` re-fetches the query. `.set(value)` replaces its value. Both also work on the server inside `form`/`command` (see §5). Since 2.65 a query can refresh other queries [C2 #16012].

### `query.batch(schema, fn)`

- Solves the n+1 problem. Calls made in the same macrotask are grouped. The server callback receives an array of arguments and must return `(input, index) => output` [D1].
- Fixes since 2.51: cross-talk between batches (2.60.1), SSR dedupe (2.56), and non-exported batch functions sharing a batch (3.1.1) [C1, C2].

### `query.live(schema?, asyncGeneratorFn)` (new since 2.59)

- Streams values over SSE. During SSR, the first yielded value is serialised. On the client, the connection stays open while the query is in use, and the instance has `.connected` and `.reconnect()`, is async-iterable, and has no `.refresh()` [D1; C2 #15705, #15957].
- Most open bugs are in this API (#17595, #17638, #17668) [G2].

### `form(schema?, fn)`

- Returns an object to spread onto `<form>`. It works without JavaScript (`method`/`action`) and is progressively enhanced by an attachment [D1].
- **Fields:** use `form.fields.<name>.as(type, value?)`. Each field has `.issues()`, `.value()`, `.set()`, `.touched()` and `.dirty()`. The form has `fields.allIssues()`, `.result`, `.pending`, `.submitted`, `.validate({ all })`, `.preflight(schema)`, `.enhance(cb)`, `.for(id)` and `.submit()` [D1; C1 #16208, #14692; C2 #14811, #15657].
  - Changes since 2.51: `.as(type, default)` (2.56), `validate({ includeUntouched })` renamed to `all` (3.0), and the `enhance` callback now receives the form instance (`form.submit()`, `form.element`) instead of `{ form, data, submit }` [D251 vs D1; C2 #15657].
- Field names starting with `_` (for example `_password`) are not echoed back after an invalid no-JS submit [D1].
- `invalid(issue.field('msg'))` from `@sveltejs/kit` marks a field invalid from inside the handler [D1].
- By default, a successful submit **invalidates all queries and `load` functions**. Calling `refresh()`/`set()`/`reconnect()` in the handler replaces that default with only those updates [D1].

### `command(schema?, fn)`

- Writes data from anywhere, such as an event handler. The docs say to prefer `form` because it works without JavaScript [D1].
- A command **cannot be called during render** (`remote_command_render`) and **cannot `redirect`**. Use `error(401)`, or return `{ redirect }` and handle it on the client [D1; K320 messages].
- Unlike `form`, a command **invalidates nothing** by default [D1].
- Commands can receive `File` objects since 2.64 [C2 #15978].

### `prerender(schema?, fn, { inputs?, dynamic? })`

- Runs at build time. Results are served as static files and cached in the browser `Cache` API until the next deployment. Use it for data that changes at most once per deployment, and never for private data [D1].
- Without `dynamic: true`, an argument that was not prerendered cannot be called (`remote_prerender_not_dynamic`) [D1; K320].
- An Admin framework is mostly private and dynamic, so this is useful only for public reference data.

### `getRequestEvent()`

- Works inside `query`, `form` and `command` [D1].
- Headers cannot be set. Cookies can be written only in `form`/`command` [D1].
- **Kit 3 breaking:** inside any `query` (including `batch`/`live`), reading `event.url`, `event.params` or `event.route` **throws** ("Pass the value as an argument to the query instead") [C1 #16452; K320 `remote_request_property`]. In 2.51 these were allowed, with a warning that they describe the *calling page* [D251].
- In `form`/`command`, `url`/`params`/`route` describe the calling page. They come from the client, so never use them for authorisation [D1].
- `event.fetch` stays available. This repo's Providers use only `getRequestEvent().fetch`, so they are unaffected.

## 5. Single-flight mutations, `.refresh()`, invalidation

A single-flight mutation returns the refreshed query data in the same response as the `form`/`command` result [D1].

**Server-driven** (recommended when the server knows which queries changed):

```ts
export const deleteOne = command(z.string(), async (id) => {
  await provider.deleteOne(id);
  void getOne(id).refresh();     // or getOne(id).set(value)
  void getMany(params).refresh(); // only refreshes the instance with *these* args
});
```

Since 2.59, the promise from a server-side `refresh()` only means the refresh was scheduled, so `void` is fine and the framework awaits it [C2 #15705]. Since 3.0, refreshes are deferred until the command body has finished [C1 #16225].

**Client-requested** (when only the client knows which instances, such as `getMany({ page: 3, filter })`, are on screen):

```ts
// client
await deleteOne(id).updates(getMany, getOne(id).withOverride(() => null));
// server: the handler MUST accept the requested updates
import { requested } from '$app/server';
export const deleteOne = command(z.string(), async (id) => {
  await provider.deleteOne(id);
  await requested(getMany, 10).refreshAll(); // or loop: { arg, query, ignore }
});
```

- `.updates()` accepts a whole query function (meaning every active instance), a specific instance, or an instance with `.withOverride(fn)` for optimistic updates [D1].
- `requested(fn, limit)`: `limit` has been required since 2.58, as protection against denial of service. It yields `{ arg, query, ignore }` (the shape changed in 2.58), and has `.refreshAll()` and `.ignoreAll()` [C2 #15739; D1].
- **Behaviour by version:**
  - 2.51: the server refreshed whatever keys the client sent, with no opt-in [K251 `serialize_refreshes`; D251].
  - 2.56 ("rework client-driven refreshes"): the server must accept requests through `requested` [C2 #15562; D270].
  - 3.0 ("error when a client-requested single-flight mutation isn't respected by the server"): a request that is not handled puts that query on the client into an **error state** [C1 #16892; B4].
- **Invalidation outside mutations:**
  - `query().refresh()` on the client.
  - Kit 3 adds `refreshAll` and deprecates `invalidateAll` [C1 #16289].
  - Clicking a link to the current URL now refreshes all `load` functions and queries [C1 #16572].
  - Known issue: an older response can overwrite a newer value (#17354) [G2].

## 6. Validation (Standard Schema and Zod)

- Every function type takes a [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType …) as its first argument. Pass `'unchecked'` to opt out [D1].
- Zod 4, which this repo uses, implements Standard Schema.
- When a `query`/`command`/`prerender` argument fails validation, the response is a generic **400**.
  - **Kit 3 breaking:** `handleValidationError` was removed. Failures now go to `handleError` with `kind: 'validation'` and `issues` [C1 #16672; D1]. In 2.51 they went to `handleValidationError` [D251].
- Logs now include the remote function's name and file (3.2) [C1 #17495].
- For `form`, a validation failure fills `fields.*.issues()` instead of throwing [D1].
- `requested()` throws for schemas with async validation (`remote_requested_async_validator`) [K320 messages].

## 7. Async Svelte: `await`, `$derived(await …)`, `<svelte:boundary>`, `$effect.pending`

- **Where `await` works** (since 5.36, behind the flag): at the top level of `<script>`, inside `$derived(...)`, and in markup [S1].
- **Synchronised updates:** when state that an `await` depends on changes, the UI keeps showing the old consistent view until the new value resolves. Independent `await`s run in parallel. Sequential `$derived(await …)` declarations wait on each other the first time (they trigger an `await_waterfall` warning), then update independently [S1].
- **Loading UI:**
  - A `<svelte:boundary>` with a `pending` snippet is shown only on *first* render.
  - Later updates do not show it again. Use `$effect.pending()` (the number of pending promises in the current boundary, excluding child boundaries) for refresh spinners.
  - Use `settled()` to wait for an update to finish [S1, S2, S3].
- **Errors:** an error in an `await` goes to the nearest boundary's `failed(error, reset)` snippet or `onerror` [S1, S2].
  - Since Svelte 5.53 and Kit 2.54, error boundaries also work during SSR (`transformError`, routed through Kit's `handleError`) [S-CL 5.53.0; C2 2.54.0; S2].
  - During SSR, a boundary with a `pending` snippet renders *only* that snippet. All other awaits finish before the response is sent. Streaming is planned but not done [S1].
- **Remote functions together with async Svelte:** `const post = $derived(await getPost(params.slug))` is the documented pattern. Pending and error states go to the nearest boundary. The alternative is reading `.loading`/`.error`/`.current` without `await` [D1].
- **`fork()`** (Svelte 5.42) supports preloading. In Kit it is behind `experimental.forkPreloads` [S1; C2 #15135].
- **Svelte changes from 5.51 to 5.57.3:** no new async API. There were many async correctness fixes (hydration, forks, boundary reset, obsolete-branch aborting, `hydratable` XSS fix in 5.55.7) [S-CL]. Kit 3 requires Svelte ≥ 5.56.4 [C1].

## 8. Known limitations and open questions

- **Security model.** Every exported remote function is a public HTTP endpoint under `/_app/`. Route guards in `handle` do not protect them, so auth must be checked inside each function (for example a `requireLogin()` helper using `getRequestEvent().locals`) [D1 "Implications for authentication"]. Issue #17090, "Remote functions are unnecessarily dangerous to use", proposes per-function guards and is `needs-decision` (opened 2026-09-10) [G3].
- **Responses** carry `cache-control: private, no-store` (2.65.2) [C2 #16020].
- **Queries are unusable on fully prerendered pages.** Commands cannot run during render and cannot redirect [D1].
- **Open bugs** [G2]:
  - Out-of-order query responses (#17354).
  - `.current`-only queries evicted mid-load (#17653).
  - `requested()` throws when a command is called from `+server.ts` (#17035).
  - `form.action` after `await query()` throws about `event.url` (#16818).
  - No raw binary responses (#16524).
  - Several `query.live` hangs.
- **Svelte caveat:** `await`/`$effect.pending()` semantics may change outside a semver major [S1].

## 9. What changed between this repo's versions and latest, and what it means here

Changes that affect this repo, in the order you would hit them when upgrading:

1. **Kit 3 platform:**
   - Node 22+, TypeScript 6, Vite 8, `vite-plugin-svelte` 7, Svelte ≥ 5.56.4.
   - Config moves to `vite.config.ts`.
   - `$lib` is replaced by `#lib`, and imports need explicit extensions. This repo imports `$lib/resource` throughout.
   - Migrate with `npx sv migrate sveltekit-3` [C1; B3].
2. **Client-requested refreshes need server opt-in.** `resource-table-actions.svelte` calls `result.updates(getMany, getOne)`. The `deleteOne` command built in `src/lib/resource/define-resource.ts` never calls `requested(...)`. That works on 2.51 but does nothing on ≥2.56, and makes those queries error on ≥3.0 [C1 #16892; C2 #15562]. The fix belongs inside `defineResource`: each generated command should call `requested(getMany, N).refreshAll()` and, where relevant, `getOne(id).refresh()/.set()`.
3. **Remote types** move to `$app/server`, and `handleValidationError` becomes `handleError({ kind: 'validation' })` [C1].
4. **The `enhance` callback signature changed**, which matters if remote `form` is adopted for create and edit [C2 #15657].
5. **`event.url`/`params`/`route` now throw inside queries.** This repo's Providers only use `fetch`, so this is safe today. Any future Provider that reads the page URL must take it as a query argument [C1 #16452].
6. **Existing bug, independent of the upgrade:** `vite build` fails at HEAD on 2.51.0. Reproduced 2026-11-13 by copying HEAD to a scratch directory and running `npx vite build` with the repo's installed `node_modules`:

   ```
   Cannot import $app/server into code that runs in the browser, as this could leak sensitive information.
    src/routes/[resource=resource]/+layout.svelte imports
     $lib/resource/index.ts imports
      $lib/resource/define-resource.ts imports
       $app/server
   ```

   `defineResource` (which calls `query`/`command`) is exported from the same barrel (`$lib/resource`) that client components import for metadata and components. `src/resources.ts`, which the client imports, also imports each `*.resource.ts` (which imports `$app/server` and the Provider) to read `metadata`. The client-safe parts (metadata, Field definitions, components) need to be split from the server-only part (the remote functions and Provider), so that only the generated `.remote.ts` file reaches across the boundary. This research did not check whether `vite dev` reports the same error.

## Sources

- [D1] SvelteKit docs, Remote functions (main, Kit 3.2): https://svelte.dev/docs/kit/remote-functions; source https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/60-remote-functions.md
- [D251] Same page at tag `@sveltejs/kit@2.51.0`: https://github.com/sveltejs/kit/blob/%40sveltejs/kit%402.51.0/documentation/docs/20-core-concepts/60-remote-functions.md
- [D270] Same page at tag `@sveltejs/kit@2.70.4`: https://github.com/sveltejs/kit/blob/%40sveltejs/kit%402.70.4/documentation/docs/20-core-concepts/60-remote-functions.md
- [C1] SvelteKit changelog, 3.x entries: https://github.com/sveltejs/kit/blob/main/packages/kit/CHANGELOG.md (3.2.0, 3.1.1, 3.1.0, 3.0.0 sections; PR numbers cited inline)
- [C2] SvelteKit changelog, 2.52.0–2.70.x entries (same file)
- [K251] `@sveltejs/kit@2.51.0` npm tarball source: `src/exports/vite/index.js` (guard plugin, remote module detection), `src/runtime/server/remote.js` (`serialize_refreshes`), `src/exports/internal/remote-functions.js`
- [K320] `@sveltejs/kit@3.2.0` npm tarball source: `src/exports/internal/server/remote-functions.js` (`init_remote_functions`), `src/exports/vite/utils.js` (`remote_module_pattern`), `src/exports/vite/plugins/guard.js`, `src/messages/*.js`, `src/runtime/app/server/remote/requested.js`
- [B2] "SvelteKit 3 release candidate", svelte.dev blog, 2026-08-13: https://svelte.dev/blog/sveltekit-3-release-candidate
- [B3] "SvelteKit 3 is here", svelte.dev blog, 2026-10-01: https://svelte.dev/blog/sveltekit-3-is-here
- [B4] "What's new in Svelte: October 2026", svelte.dev blog: https://svelte.dev/blog/whats-new-in-svelte-october-2026
- [S1] Svelte docs, `await` expressions: https://svelte.dev/docs/svelte/await-expressions; source https://github.com/sveltejs/svelte/blob/main/documentation/docs/03-template-syntax/19-await-expressions.md (compared against tag `svelte@5.51.0`)
- [S2] Svelte docs, `<svelte:boundary>`: https://svelte.dev/docs/svelte/svelte-boundary
- [S3] Svelte docs, `$effect.pending`: https://svelte.dev/docs/svelte/$effect#$effect.pending
- [S-CL] Svelte changelog: https://github.com/sveltejs/svelte/blob/main/packages/svelte/CHANGELOG.md (5.51.1–5.57.3)
- [G1] Remote Functions RFC, sveltejs/kit discussion #13897: https://github.com/sveltejs/kit/discussions/13897
- [G2] Open sveltejs/kit issues matching "remote functions" (111 on 2026-11-13): https://github.com/sveltejs/kit/issues?q=is%3Aissue%20is%3Aopen%20remote%20functions
- [G3] sveltejs/kit#17090 "Remote functions are unnecessarily dangerous to use": https://github.com/sveltejs/kit/issues/17090
- [N1] npm registry, `@sveltejs/kit`: https://registry.npmjs.org/@sveltejs/kit
- [N2] npm registry, `svelte`: https://registry.npmjs.org/svelte
