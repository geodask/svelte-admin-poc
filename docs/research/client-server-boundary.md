# Client/server boundary of the generated `resources.ts`

Linear: PER-9 (parent map PER-6, "Svelte Admin direction review").
Researched 2026-11-13 against commit `2b77500` (branch `master`).
Versions: `@sveltejs/kit` 2.51.0, `svelte` 5.51.0, `vite` 7.3.1, Bun 1.4.4.

## Answer

**Yes, the proof of concept ships Provider code to the browser.** A production
build puts every Resource's Provider (backend URLs, request code, response
parsing) into a client chunk. The root layout, the `[resource=resource]` layout
and the client app entry (which holds the param matcher) all load that chunk.
The same chunk also pulls in the **server** build of `$app/server`:
`getRequestEvent` with its `AsyncLocalStorage` lookup, and the server versions
of `query` and `command`.

SvelteKit's server-only import guard **does not fire**. The remote-functions
transform does not help either: it rewrites only `*.remote.ts` modules, and
`src/resources.ts` reaches the Provider code without going through one. In
this project the guard check for `$app/server` can never match, because of a
path-normalization order in SvelteKit itself (details below). If that one
comparison is fixed, the same build fails with
`Cannot import $app/server into code that runs in the browser`. So, by
SvelteKit's own rules, the current Admin framework design is illegal.

## How the leak happens

1. `src/lib/vite-plugin-generate-resources.ts` generates two files:
   - `src/resources.remote.ts` re-exports `getMany` / `getOne` / `create` /
     `update` / `deleteOne` from each `src/resources/*.resource.ts`.
   - `src/resources.ts` imports **each `*.resource.ts` directly**, to read
     `resource.metadata`, and also imports the remote functions from
     `./resources.remote`.
2. Each `*.resource.ts` file calls `defineResource(name)({ schema, provider, ... })`.
   That one object literal holds the Provider factory: the
   `fetch('https://pokeapi.co/...')` and `https://dummyjson.com/...` calls, plus
   `getRequestEvent` from `$app/server`. `defineResource`
   (`src/lib/resource/define-resource.ts`) imports `query` and `command` from
   `$app/server`, calls the Provider factory, and returns
   `{ metadata, getMany: query(...), ... }`.
3. Client code imports `src/resources.ts`:
   - `src/routes/+layout.svelte` (`useResources`)
   - `src/routes/[resource=resource]/+layout.svelte` (`useResource`)
   - `src/params/resource.ts`, the param matcher. Matchers run in the browser
     during client-side routing.

   `src/lib/components/site-header.svelte` imports only `type ResourceMap`, so
   it adds nothing to the bundle.
4. SvelteKit's client transform rewrites only modules whose names end in
   `.remote.ts`. Their exports are replaced with fetch stubs (see
   [SvelteKit source](#sveltekit-source-pinned-to-2510)). In the build,
   `resources.remote.ts` correctly becomes stubs such as
   `P("1wnf702/berriesGetMany")`. But `resources.ts` *also* imports the
   `*.resource.ts` modules directly, and those are ordinary modules. Rollup
   bundles them whole: the Provider factory, the `defineResource` call, and
   everything they import, including the real `$app/server` runtime. Tree
   shaking cannot drop the Provider, because `metadata` is a property of the
   very object that `defineResource(...)` builds from the Provider.
5. There is a second path that does not involve `resources.ts`. The
   `[resource=resource]` layout and page import `* as Resource from
   '$lib/resource'`. That barrel re-exports `defineResource`, which imports
   `$app/server`, and `simpleRestProvider`. The working guard (see below)
   reported this chain first.

By reading the code (not observed at runtime): in the browser, the Provider
functions are bundled but never *called*. The UI calls the fetch stubs from
`resources.remote.ts`. However, `defineResource(...)` does *execute* in the
browser at import time, building server-flavoured `query`/`command` objects
there.

## Why the server-only guard does not fire

The guard is `vite-plugin-sveltekit-guard`. Its `load` hook runs for non-SSR
loads (`index.js` L573) and treats a module as server-only when its
*normalized* id equals `'$app/server'` (L582–587). The normalized id comes from
`normalize_id(id, lib, cwd)` (`utils.js` L125–138):

```js
if (id.startsWith(cwd)) {
	id = path.relative(cwd, id);   // L132–134: runs first
}
if (id === app_server) {           // L136: app_server is an ABSOLUTE path
	return '$app/server';
}
```

`app_server` is the absolute path of
`node_modules/@sveltejs/kit/src/runtime/app/server/index.js`
(`module_ids.js` L14). When SvelteKit is installed in the project's own
`node_modules` (inside `cwd`, the usual layout), the cwd prefix is stripped
*before* the comparison. The result is the relative path
`node_modules/@sveltejs/kit/src/runtime/app/server/index.js`, so it can never
equal the absolute `app_server`. The `'$app/server'` branch of the guard is
dead code here.

Evidence, from a temporary log line in the guard (node_modules only, reverted
afterwards):

```
[GUARD-DEBUG] load {"id":"/…/node_modules/@sveltejs/kit/src/runtime/app/server/index.js",
                    "normalized":"node_modules/@sveltejs/kit/src/runtime/app/server/index.js",
                    "is_server_only":false}
```

Calling SvelteKit's own `normalize_id` and `app_server` directly from Node
gives the same result:

```
app_server              = /…/node_modules/@sveltejs/kit/src/runtime/app/server/index.js
normalize_id(app_server) = node_modules/@sveltejs/kit/src/runtime/app/server/index.js
```

**Counter-experiment.** I temporarily added
`if (id === app_server) return '$app/server';` at the top of `normalize_id`
(node_modules only, reverted afterwards) and rebuilt. The build then fails as
the docs say it should:

```
Cannot import $app/server into code that runs in the browser, as this could leak sensitive information.

 src/routes/[resource=resource]/+layout.svelte imports
  $lib/resource/index.ts imports
   $lib/resource/define-resource.ts imports
    $app/server
```

(The guard prints only the first chain it walks. The
`+layout.svelte → resources.ts → berries.resource.ts → $app/server` chain is
there too.)

The same ordering is in `@sveltejs/kit` **2.70.4**, the latest `version-2`
dist-tag at the time of writing (`src/exports/vite/utils.js` L146–159, guard
check at `index.js` L734–740). Upgrading within v2 would not change this. I
found no upstream issue that reports it.

The other guard rules do not depend on this comparison:
`normalized.startsWith('$lib/server/')` works because `$lib` is substituted
before the cwd strip. The `*.server.*` basename test (L587) uses the raw id.
Both would still catch server-only code placed under `$lib/server/` or in
`*.server.ts` files. I confirmed this by reading the code, not by test.

## Evidence (exact commands)

Run from the repo root:

```sh
bun install                   # 400 packages; bun.lock changed (not committed)
bun run build                 # vite build, exit 0, no guard error
cd .svelte-kit/output
for s in 'pokeapi.co' 'dummyjson.com' 'Failed to fetch berries' 'getRequestEvent' \
         'Can only read the current request event' 'AsyncLocalStorage' "Cannot call '" '$app/server'; do
  printf '%-42s client:%s server:%s\n' "$s" \
    "$(grep -rlF -- "$s" client | wc -l)" "$(grep -rlF -- "$s" server | wc -l)"
done
```

Output (number of files containing the string):

```
pokeapi.co                                 client:1 server:1
dummyjson.com                              client:1 server:1
Failed to fetch berries                    client:1 server:1
getRequestEvent                            client:0 server:1
Can only read the current request event    client:1 server:0
AsyncLocalStorage                          client:1 server:1
Cannot call '                              client:2 server:2
$app/server                                client:0 server:1
```

The literal name `getRequestEvent` and the `$app/server` specifier are
minified away in the client, but the implementation is there. The client
chunk that holds the Providers (`_app/immutable/chunks/_Ic32iVe.js`, 13.5 kB;
hashes change per build) contains, verbatim:

```js
const{fetch:e}=v(),a=await e("https://pokeapi.co/api/v2/berry")
```

Here `v` is imported from a second client chunk (`DTdeIDVr.js`), where it is
SvelteKit's server `getRequestEvent`:

```js
function Ql(){const e=An()?.event;if(!e){let t="Can only read the current request event …
```

The same second chunk also holds the server `query` implementation, including
``throw new Error(`Cannot call '${o.name}.withOverride()' on the server`)``.
The chunk with the Providers also contains all `dummyjson.com` Provider
methods (`/recipes/add` POST, PUT, DELETE), the `defineResource` body, and the
fetch stubs `P("1wnf702/berriesGetMany")`.

The chunk is imported by:

```
_app/immutable/nodes/0.*.js   (src/routes/+layout.svelte)
_app/immutable/nodes/2.*.js   (src/routes/[resource=resource]/+layout.svelte)
_app/immutable/entry/app.*.js (client app entry; holds the param matchers)
```

The node numbers come from `.svelte-kit/output/client/.vite/manifest.json` and
`.svelte-kit/generated/client-optimized/nodes/2.js`.

## The correct boundary

The SvelteKit docs draw the line, and the build output confirms it:

- **May be shared (client and server)**: Resource metadata, meaning name,
  label, icon, menu, flags such as `searchable`/`selectable`/`exportable`, the
  Zod schema, and Field metadata, including `views.*.render` functions, which
  are client UI code. This must live in a module that imports nothing from
  `$app/server`, `$lib/server`, `*.server.*` or a Provider. The remote-functions
  docs say this directly: a schema cannot be exported from a `.remote.ts` file,
  so "the schema must either be exported from a shared module" or from the
  component.
- **Server only**: the Provider (backend URLs, credentials, `fetch`, response
  parsing) and the `query`/`command` definitions that wrap it. These belong in
  `.remote.ts` files, or in `$lib/server/` / `*.server.ts` modules that only
  `.remote.ts` files import. The docs say remote functions "always _run_ on
  the server, meaning they can safely access server-only modules". Putting
  Providers under `$lib/server/` or `*.server.ts` also brings back a guard
  rule that works today, as a backstop.
- **What the client gets from the server side**: only the fetch stubs that
  SvelteKit generates from `.remote.ts` exports.
- **Consequences for this proof of concept**:
  - The generated `resources.ts` (the client-side Resource registry) must
    import only the shared metadata modules and `./resources.remote`, never a
    module that also defines the Provider.
  - A single `defineResource({ schema, provider, ... })` object that holds both
    halves cannot be imported by client code.
  - The `$lib/resource` barrel must not re-export server-only pieces
    (`defineResource`, which imports `query`/`command`, and
    `simpleRestProvider`) next to client components.
- **Do not rely on the guard**: in this setup it is silent for `$app/server`.
  Until that is fixed upstream, the boundary has to come from the file
  structure, or from a check of the build output like the grep above.

This note records facts and the boundary only. It does not choose how the
Admin framework should split its Resource definition.

## Sources

### SvelteKit docs (pinned to the 2.51.0 tag)

- Server-only modules:
  <https://github.com/sveltejs/kit/blob/%40sveltejs/kit%402.51.0/documentation/docs/30-advanced/50-server-only-modules.md>.
  It says "The `$app/server` module … can likewise only be imported by code
  that runs on the server", and that any public-facing code that imports
  server-only code, "whether directly or indirectly", makes SvelteKit error.
  Live page: <https://svelte.dev/docs/kit/server-only-modules>. The live page
  now documents a newer major version, with `$app/env/private` and `#lib`.
- Remote functions:
  <https://github.com/sveltejs/kit/blob/%40sveltejs/kit%402.51.0/documentation/docs/20-core-concepts/60-remote-functions.md>.
  L9: "can be _called_ anywhere in your app, but always _run_ on the server".
  L36: "On the client, the exported functions are transformed to `fetch`
  wrappers"; remote files are `.remote.js`/`.remote.ts`. L553: "you cannot
  export a schema from a `.remote.ts` or `.remote.js` file, so the schema must
  either be exported from a shared module…". Live page:
  <https://svelte.dev/docs/kit/remote-functions>.

### SvelteKit source (pinned to 2.51.0)

Read from the installed `node_modules/@sveltejs/kit` and the tag
<https://github.com/sveltejs/kit/tree/%40sveltejs/kit%402.51.0/packages/kit/src/exports/vite>:

- `index.js` L546–648: `vite-plugin-sveltekit-guard`. L573 skips SSR loads.
  L582–587 holds the `is_server_only` rules, including
  `normalized === '$app/server'`. L638 is the error message.
- `index.js` L664–786: `vite-plugin-sveltekit-remote`. L742 is the comment
  "For the client, read the exports and create a new module that only contains
  fetch functions". L780 emits `import * as __remote from '__sveltekit/remote'`
  stubs. It applies only to ids that end in `.remote${ext}`.
- `utils.js` L125–138: `normalize_id`. The cwd strip at L132 comes before the
  `app_server` comparison at L136.
- `module_ids.js` L14: `app_server` is an absolute path.
- The same code is in `@sveltejs/kit@2.70.4` (npm tarball,
  `src/exports/vite/utils.js` L146–159, `index.js` L734–740).

### This repository

- `src/lib/vite-plugin-generate-resources.ts`: generates both files.
- `src/resources.ts`, `src/resources.remote.ts`: the generated output (tracked
  in git).
- `src/resources/berries.resource.ts`, `src/resources/recipes.resource.ts`:
  the Providers.
- `src/lib/resource/define-resource.ts`, `src/lib/resource/index.ts`.
- `src/routes/+layout.svelte`, `src/routes/[resource=resource]/+layout.svelte`,
  `src/params/resource.ts`, `src/lib/components/site-header.svelte`.
