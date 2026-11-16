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
bun run dev                                    # the demo app; open http://localhost:5173/admin
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
2. A remote module of one statement: `src/lib/resources/recipes.remote.ts` re-exports the remote functions of `serveResource(recipes, backend.for(recipes))`.
3. One entry in `src/lib/admin.ts`, which `src/params.ts` also reads for the Resource param matcher, and the shell for its sidebar.

`defineResource` also takes an optional sidebar `group` and `icon`. The icon is a lazy import of a Lucide icon, such as `icon: () => import('@lucide/svelte/icons/chef-hat')`: SvelteKit loads `src/params.ts`, and so every Resource module, in plain Node at build time, where a `.svelte` file can't load.

The admin layout renders the Theme's `AdminShell` with the admin from `admin.ts` and the app's own `brand` and `userMenu` snippets (the shell wraps the brand in a link to the first Resource). The `/admin` index redirects to the first Resource's list.

`@svelte-admin/core` is the browser-safe entry. `serveResource` lives in `@svelte-admin/core/server` and the bundled REST Provider in `@svelte-admin/core/rest`; import those only from `.remote.ts` files and server-only modules.

## Writes

The remote module re-exports `getList`, `getOne`, `create`, `update`, `deleteOne` and `deleteMany` from `serveResource`. A Provider implements `create(ctx, data)`: it gets the record without its id, already validated with the Resource's schema, and returns the record the backend saved. The bundled REST Provider sends it as `POST {base}/{resource}`. It also implements `update(ctx, { id, data })`: `id` has the schema's id type and `data` is the whole editable record, so an optional Field whose key is absent was cleared by the user (there are no partial patches). It returns the saved record, with the same id. The bundled REST Provider sends it as `PUT {base}/{resource}/{id}`, with the id written by `idPathSegment`.

The create View lives at `{list}/new` (the demo's `src/routes/admin/[resource=resource]/new/+page.svelte` renders the Theme's `CreateView`). Its form is generated from the schema at runtime, and works with and without JavaScript. After a save, `create` redirects to the new record's detail View. It finds that path from the page the form was submitted from: inside a remote form, `getRequestEvent().url` is the page's URL in Kit 3.2, with JavaScript and without, so `serveResource` never needs the admin's base path. A create form posted from a page whose path doesn't end in `/new` is refused before the Provider is called.

The edit View lives at `{list}/{id}/edit` (the demo's `src/routes/admin/[resource=resource]/[id]/edit/+page.svelte` renders the Theme's `EditView`; the id param becomes the typed id in `[id]/+layout.ts`, a 404 when it names none). The detail View links to it with "Edit". It is prefilled with the record's values, also without JavaScript, through `form.fields.set(...)` during render, which Kit skips after a failed submit, so what the user typed survives. The record's id travels as a hidden input and becomes the typed id by the same rule as a route param. After a save, `update` sets `getOne(id)` to the saved record, refreshes the list queries the client has, and redirects with a 303 to the detail View: the page's path minus `/edit`. An edit form posted from any page but the edit View of the record its hidden id names is refused before the Provider is called.

The detail View also has "Delete", which opens the Theme's `DeleteDialog`: it names the record by its Record title, and on failure stays open with the reason and Try again. A Provider implements `deleteOne(ctx, id)`, with the schema's id type; the bundled REST Provider sends it as `DELETE {base}/{resource}/{id}` and expects a 204. `serveResource`'s `deleteOne` is a remote command, so it needs JavaScript, and Delete appears only once the page is hydrated. The core's `createDetailView(...).delete()` calls `deleteOne(id).updates(getList)`, so the server refreshes the list queries the client has, then goes to the list View. A Provider error reaches the dialog with its status and message, as on reads (a 404 for a record already deleted).

The list View's toolbar shows "Delete selected (N)" once rows are selected (after hydration, like Delete). It opens the same `DeleteDialog` with the count of selected rows on every page ("Delete 3 selected records from Recipes?"). The core's `createListView(...).deleteSelected()` calls `deleteMany(ids).updates(getList)` with the selection's ids. `serveResource`'s `deleteMany` is a remote command that takes one to 1,000 typed ids (anything else is invalid input) and ignores duplicates. It calls the Provider's optional `deleteMany(ctx, ids)` when there is one, which should be all or nothing; otherwise it calls `deleteOne` for each id in turn, stopping at the first failure. It reports how many records it deleted (and, when it stopped, why) instead of throwing, so the list queries are refreshed either way: Kit sends no refreshed queries with a failed command. On success the selection clears; when it stops partway, the dialog says how many were deleted, and only the rest stay selected, ready to try again. The bundled REST Provider has no `deleteMany`, since its convention has no bulk route. To use a backend's bulk route for one Resource, spread the REST Provider and add it, as the demo does for posts in `src/lib/server/posts-provider.ts` (`DELETE /posts?id=1&id=2`).

### Typed form fields and a replaced form View

`field(schema, meta)` brands the schema's type with `readOnly`, `hidden` and `input` (write the metadata inline), and the brand survives `.optional()`, `.nullable()` and `.default()` on either side. From it, `FormInput<R, mode>` is the input type of `formSchema(resource, mode)`: each editable Field maps to what its input sends, the id and the read-only and hidden Fields are left out, `'afterCreate'` Fields appear on create only, booleans are optional (as Kit requires), and the edit form adds the typed `id` of its hidden input. `CreateData<R>` and `EditData<R>` are the form schema's output for each mode, and type the Provider's `create` data and `update` data: a Provider whose `create` expects a read-only Field is rejected. `serveResource` and `restProvider(...).for(resource)` infer all of them from the Resource.

`ListParams<R>` types the params a Resource's `getList` receives the same way: a page and a page size, plus an optional `search` only when the Resource is `searchable: true` (one that isn't searchable has no `search` in its type). `serveResource`, `restProvider(...).for(resource)`, the remote `getList` and `createListView(...).params` all infer it from the Resource, and a Provider whose `getList` is written against the loose `ListParams` still fits any Resource. `encodeListParams(params, defaults?)` is the one encoding of list params as URL search params (`page`, `perPage`, the sort as `sort` and `order`, then the search as `q`): the list URL and its hrefs use it with their defaults left out, and the bundled REST Provider uses it with every param written, so the two can't drift.

So the `create` and `update` forms a `.remote.ts` exports have typed `fields`. An app replaces one create or edit View with a route at its path, built on the core's `createFormView` (from `@svelte-admin/core/views`), whose `form` keeps that type, and on the Theme's `FieldInput`, `FieldIssues` and `FormActions`. The demo does this for posts in `src/routes/admin/posts/new/+page.svelte`: it renders the title from `form.fields.title` itself, lays the other Fields out in two columns, and has an `@ts-expect-error` line where it reads the read-only `viewCount`.

adapter-node checks a form post's origin, so set `ORIGIN` when you run the built app (the e2e suite sets `http://localhost:4173`).

## List power

### Sorting

Mark a Field `sortable: true` with `field()` when the backend can sort by it, written inline beside its label: `name: field(z.string(), { label: 'Name', sortable: true })`. Fields are not sortable unless they say so, and only a scalar Kind (text, number, date, enum, boolean) can be: `defineResource` throws at startup for a sortable list, object or unknown Field. Like `readOnly`, the setting is in the schema's type, and it survives `.optional()`, `.nullable()` and `.default()` on either side. A hidden Field may be sortable too: it gets no header, but the URL can still sort by it.

The list View's header of a sortable Field is a link (the Theme's `SortHeader`): the first click sorts the whole list ascending on the server, the second descending, the third goes back to the default order (see below). Each starts again at page 1 and keeps the search and the page size; the selection is unchanged. The sorted header shows an arrow and carries `aria-sort`. Other headers are plain text. It works without JavaScript, since each click is a plain link. A replaced list View reads `createListView(...).sortState(key)` (`'asc'`, `'desc'` or `undefined`) and `sortHref(key)`.

`getList` then receives `sort?: { field, order: 'asc' | 'desc' }`, where `field` is typed as the union of the Resource's sortable keys (`SortableKey<R>`). It is absent when the list isn't sorted, never empty, and a Resource with no sortable Field has no `sort` in its `ListParams` at all. The server rejects a sort on any other Field before the Provider runs.

The list URL writes the sort as `sort=<field>`, plus `order=desc` to reverse it: ascending is the default, so `order=asc` is never written. A sort on an unknown or non-sortable Field, an `order` without a `sort`, and `order=asc` are dropped when the URL is read, and with JavaScript the URL is cleaned in place.

The bundled REST Provider sends the sort in the same encoding, but always with its order: `GET {base}/{resource}?page=1&perPage=25&sort=name&order=asc`, so a backend never has to know the default. A backend that can't do a declared sort should answer 400. The demo backend sorts any Resource by any Field: numbers as numbers, text and ISO dates with a locale compare, stable, with records that have no value last in both orders.

### Filtering

Mark a Field `filterable` with `field()` when the backend can filter by it: `difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true })`. `true` allows every operator of the Field's Kind; a non-empty list allows only those, such as `filterable: ['eq', 'in']` on a text Field for a backend that can only match it exactly. Fields are not filterable unless they say so. The operators per Kind are:

| Kind    | Operators                      |
| ------- | ------------------------------ |
| text    | `eq`, `in`, `contains`         |
| number  | `eq`, `lt`, `lte`, `gt`, `gte` |
| date    | `eq`, `lt`, `lte`, `gt`, `gte` |
| enum    | `eq`, `in`                     |
| boolean | `eq`                           |

`defineResource` throws at startup for a filterable list, object or unknown Field, an operator the Field's Kind doesn't have, an empty list, and a filterable Field whose key the list URL uses for itself (`page`, `perPage`, `sort`, `order`, `q`) or holds a `.`. TypeScript rejects those keys too. Like `sortable`, the setting is in the schema's type, so write it inline (or `as const`). A hidden Field may be filterable: it gets no control, but the URL can still filter by it.

`getList` then receives `filters?: ListFilter<R>[]`: a flat list of `{ field, operator, value }`, combined with AND, never empty and absent when there are none. Each value is typed by its Field (an enum member, a boolean, a number, a string, or the Field's own date type), and `in` takes an array of 2 to 100 distinct values. The filters come in a canonical form: at most one per Field and operator, ordered by the Fields' schema order, then by operator. A Resource with no filterable Field has no `filters` in its `ListParams` at all, and the server rejects a filter on any other Field, with another operator, with a value of the wrong type, or an `in` out of bounds before the Provider runs.

The list View's toolbar has a "Filters" disclosure (the Theme's `FilterPanel`) showing how many filters are on. It holds a GET form with one control per filterable Field that isn't hidden: a checkbox per option for an enum (one ticked filters with `eq`, several with `in`); Any / Yes / No for a boolean; a text box for a text Field, which filters with `contains` when the Field allows it, else with `eq` (showing one box per value when the URL holds an `in`, so clearing one leaves the rest); and a from and a to input for a number or date Field (`gte` and `lte`), or one input with `eq` when the Field doesn't allow the range. Either side of a range may be left empty to filter one side only. Date inputs are `date` inputs, and datetime inputs `datetime-local` ones read and written in UTC and labelled so, as in the forms. Operators no stock control offers (text `eq` when `contains` is allowed, `lt`, `gt`) still work from the URL and in a replaced View, and the filter form keeps them. "Apply" starts again at page 1 and keeps the search, the sort and the page size; "Clear filters" goes back to the whole list. It works without JavaScript; with it, the form leaves out empty controls, so the URL stays clean. Pager, page-size, sort and search links keep the filters, and the selection is unchanged. An empty list says that no records match the filters (and the search, if there is one). A replaced list View reads `createListView(...).filterControls`, `filterForm`, `filterCount`, `clearFiltersHref` and `applyFilters(formData)`.

The list URL writes a filter by its Field's key: a bare param means `eq` and a repeated one `in` (`?difficulty=Easy&difficulty=Medium`). Every other operator is a suffix: `.contains`, `.lt`, `.lte`, `.gt` and `.gte`, as in `name.contains=piz` or `prepTimeMinutes.gte=10`. Values are written as the filter form sends them:

| Value                         | In the URL                                                         | Read into                       |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| text, enum                    | as is                                                              | the text, or the enum member    |
| boolean                       | `true`, `false`                                                    | a boolean                       |
| number                        | a plain decimal: `15`, `-5`, `45.5`                                | a number                        |
| date (`z.iso.date()`)         | `YYYY-MM-DD`                                                       | the ISO date string             |
| date (`z.date()`)             | `YYYY-MM-DD`                                                       | a `Date` at midnight UTC        |
| datetime (`z.iso.datetime()`) | `YYYY-MM-DDTHH:mm` in UTC, with seconds only when they aren't zero | the ISO datetime string, in UTC |

These are the rules the forms use for their date inputs, so a filter value is always in the Field's own type. Params for an unknown or non-filterable Field, empty or malformed values (`prepTimeMinutes.gte=abc`, a date with a zone or on no real day), and operators the Field doesn't allow (`cuisine.contains` when `cuisine` allows only `eq` and `in`) are dropped when the URL is read, and with JavaScript the URL is cleaned in place.

The server checks a filter value against the Field's base type only (a string, a finite number, a boolean, an enum member, or its date type), never its refinements, so `name.contains=piz` is fine on a Field that needs five letters.

The bundled REST Provider sends the filters in the same encoding, after `q`: `GET {base}/{resource}?page=1&perPage=25&difficulty=Easy&difficulty=Hard&prepTimeMinutes.gte=10&vegetarian=true`. Values go in the Field's own type rather than as the filter input writes them: an ISO date or datetime string as it is (`publishedAt.gte=2024-03-01T00:00:00.000Z`), and a `Date` as an ISO string. A backend that can't do a declared filter should answer 400. The demo backend filters any Resource before searching and paging: `eq` and `in` match the value exactly, `contains` ignores case, and the range operators compare numbers as numbers and ISO strings as text. In the demo, recipes filter by name (`contains`), cuisine (narrowed to `eq` and `in`), difficulty, prep time, vegetarian and published date; users by role, active and joined date; and posts by author ID (one number, `eq`) and status.

### Default sort and page size

A Resource can choose the order its list opens in and how many rows a page holds:

```ts
export const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema,
	defaultSort: { field: 'id', order: 'desc' }, // newest first
	perPage: 20
});
```

`defaultSort.field` must be a sortable Field's key (a hidden one is fine, such as a hidden `createdAt`): TypeScript rejects any other where it can tell, and `defineResource` throws at startup for one that isn't sortable. Without a `defaultSort`, the list keeps the backend's order. `perPage` is a whole number from 1 to `MAX_PER_PAGE` (100), or `defineResource` throws; without it a Resource pages at `DEFAULT_PER_PAGE` (25).

Neither is written to the list URL, so links stay short: `listHref(url, params, resource)` and `listUrlRewrite` leave out the Resource's default sort and its own `perPage`, and with JavaScript a URL that writes either out is cleaned in place. `readListParams` fills them in when the URL names none, so `createListView(...).sortState(key)` reports the default sort, and the default's header shows its arrow and `aria-sort`. The default sort's own header toggles between its two orders rather than ever leaving the list unsorted; any other sortable header goes ascending, descending, then back to the default. The page-size options offer the Resource's `perPage` beside 10, 25, 50 and 100.

The default is applied on the server too: when `getList` is asked for no sort, the Provider gets the Resource's `defaultSort`, so every caller gets the same order and a Provider never needs to know the default. In the demo, posts open newest first at 20 rows a page, users in name order, and recipes in the backend's order.
