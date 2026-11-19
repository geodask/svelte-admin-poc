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
| `bun run lint`                | ESLint (which rejects `{@html}` anywhere) and Prettier                           |
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

Each route that renders a View passes it the same admin, beside the Resource and its remote functions: `<ListView {admin} {resource} {remote} />`, and likewise `DetailView`, `CreateView` and `EditView`. The core's headless helpers take it as their first argument: `createListView(admin, resource, remote)`, `createDetailView(admin, resource, remote, id)` and `createFormView(admin, resource, remote, 'create')` (or `'edit', id`). It is always an argument, never context, and it is typed as the core's `Admin`, so anything that isn't an admin is a type error. It is how the Views reach the admin's other Resources: a Reference's target, for one (see [References](#references)).

`@svelte-admin/core` is the browser-safe entry. `serveResource` lives in `@svelte-admin/core/server`, the bundled REST Provider in `@svelte-admin/core/rest`, and the export's CSV writer and pager in `@svelte-admin/core/export`; import those only from `.remote.ts` files and server-only modules.

## Writes

The remote module re-exports `getList`, `getOne`, `lookup` (see [References](#references)), `create`, `update`, `deleteOne`, `deleteMany` and `exportList` (see [Export](#export)) from `serveResource`, and nothing else. A Provider implements `create(ctx, data)`: it gets the record without its id, already validated with the Resource's schema, and returns the record the backend saved. The bundled REST Provider sends it as `POST {base}/{resource}`. It also implements `update(ctx, { id, data })`: `id` has the schema's id type and `data` is the whole editable record, so an optional Field whose key is absent was cleared by the user (there are no partial patches). It returns the saved record, with the same id. The bundled REST Provider sends it as `PUT {base}/{resource}/{id}`, with the id written by `idPathSegment`.

The create View lives at `{list}/new` (the demo's `src/routes/admin/[resource=resource]/new/+page.svelte` renders the Theme's `CreateView`). Its form is generated from the schema at runtime, and works with and without JavaScript. After a save, `create` redirects to the new record's detail View. It finds that path from the page the form was submitted from: inside a remote form, `getRequestEvent().url` is the page's URL in Kit 3.2, with JavaScript and without, so `serveResource` never needs the admin's base path. A create form posted from a page whose path doesn't end in `/new` is refused before the Provider is called.

The edit View lives at `{list}/{id}/edit` (the demo's `src/routes/admin/[resource=resource]/[id]/edit/+page.svelte` renders the Theme's `EditView`; the id param becomes the typed id in `[id]/+layout.ts`, a 404 when it names none). The detail View links to it with "Edit". It is prefilled with the record's values, also without JavaScript, through `form.fields.set(...)` during render, which Kit skips after a failed submit, so what the user typed survives. The record's id travels as a hidden input and becomes the typed id by the same rule as a route param. After a save, `update` sets `getOne(id)` to the saved record, refreshes the list queries the client has, and redirects with a 303 to the detail View: the page's path minus `/edit`. An edit form posted from any page but the edit View of the record its hidden id names is refused before the Provider is called.

The detail View also has "Delete", which opens the Theme's `DeleteDialog`: it names the record by its Record title, and on failure stays open with the reason and Try again. A Provider implements `deleteOne(ctx, id)`, with the schema's id type; the bundled REST Provider sends it as `DELETE {base}/{resource}/{id}` and expects a 204. `serveResource`'s `deleteOne` is a remote command, so it needs JavaScript, and Delete appears only once the page is hydrated. The core's `createDetailView(...).delete()` calls `deleteOne(id).updates(getList)`, so the server refreshes the list queries the client has, then goes to the list View. A Provider error reaches the dialog with its status and message, as on reads (a 404 for a record already deleted).

The list View's toolbar shows "Delete selected (N)" once rows are selected (after hydration, like Delete). It opens the same `DeleteDialog` with the count of selected rows on every page ("Delete 3 selected records from Recipes?"). The core's `createListView(...).deleteSelected()` calls `deleteMany(ids).updates(getList)` with the selection's ids. `serveResource`'s `deleteMany` is a remote command that takes one to 1,000 typed ids (anything else is invalid input) and ignores duplicates. It calls the Provider's optional `deleteMany(ctx, ids)` when there is one, which should be all or nothing; otherwise it calls `deleteOne` for each id in turn, stopping at the first failure. It reports how many records it deleted (and, when it stopped, why) instead of throwing, so the list queries are refreshed either way: Kit sends no refreshed queries with a failed command. On success the selection clears; when it stops partway, the dialog says how many were deleted, and only the rest stay selected, ready to try again. The bundled REST Provider has no `deleteMany`, since its convention has no bulk route. To use a backend's bulk route for one Resource, add it to the REST Provider's methods, as the demo does for posts in `src/lib/server/posts-provider.ts` (`DELETE /posts?id=1&id=2`).

### Typed form fields and a replaced form View

`field(schema, meta)` brands the schema's type with `readOnly`, `hidden` and `input` (write the metadata inline), and the brand survives `.optional()`, `.nullable()` and `.default()` on either side. From it, `FormInput<R, mode>` is the input type of `formSchema(resource, mode)`: each editable Field maps to what its input sends, the id and the read-only and hidden Fields are left out, `'afterCreate'` Fields appear on create only, booleans are optional (as Kit requires), and the edit form adds the typed `id` of its hidden input. `CreateData<R>` and `EditData<R>` are the form schema's output for each mode, and type the Provider's `create` data and `update` data: a Provider whose `create` expects a read-only Field is rejected. `serveResource` and `restProvider(...).for(resource)` infer all of them from the Resource.

`ListParams<R>` types the params a Resource's `getList` receives the same way: a page and a page size, plus an optional `search` only when the Resource is `searchable: true` (one that isn't searchable has no `search` in its type). `serveResource`, `restProvider(...).for(resource)`, the remote `getList` and `createListView(...).params` all infer it from the Resource, and a Provider whose `getList` is written against the loose `ListParams` still fits any Resource. `encodeListParams(params, defaults?)` is the one encoding of list params as URL search params (`page`, `perPage`, the sort as `sort` and `order`, then the search as `q`): the list URL and its hrefs use it with their defaults left out, and the bundled REST Provider uses it with every param written, so the two can't drift.

So the `create` and `update` forms a `.remote.ts` exports have typed `fields`. An app replaces one create or edit View with a route at its path, built on the core's `createFormView(admin, resource, remote, mode)` (from `@svelte-admin/core/views`), whose `form` keeps that type, and on the Theme's `FieldInput`, `FieldIssues`, `ReferencePicker` and `FormActions`. The demo does this for posts in `src/routes/admin/posts/new/+page.svelte`: it renders the title from `form.fields.title` itself, lays the other Fields out in two columns, chooses the author with `ReferencePicker` (see [The Reference picker](#the-reference-picker)), and has an `@ts-expect-error` line where it reads the read-only `viewCount`.

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

The list View's toolbar has a "Filters" disclosure (the Theme's `FilterPanel`) showing how many filters are on. It holds a GET form with one control per filterable Field that isn't hidden: a checkbox per option for an enum (one ticked filters with `eq`, several with `in`); Any / Yes / No for a boolean; a text box for a text Field, which filters with `contains` when the Field allows it, else with `eq` (showing one box per value when the URL holds an `in`, so clearing one leaves the rest); a from and a to input for a number or date Field (`gte` and `lte`), or one input with `eq` when the Field doesn't allow the range; and for a Reference, the Theme's `ReferencePicker`, which chooses the record by its Record title and sends its id, with "Any" for no filter (see [The Reference filter](#the-reference-filter)). Either side of a range may be left empty to filter one side only. Date inputs are `date` inputs, and datetime inputs `datetime-local` ones read and written in UTC and labelled so, as in the forms. Operators no stock control offers (text `eq` when `contains` is allowed, `lt`, `gt`) still work from the URL and in a replaced View, and the filter form keeps them. "Apply" starts again at page 1 and keeps the search, the sort and the page size; "Clear filters" goes back to the whole list. It works without JavaScript; with it, the form leaves out empty controls, so the URL stays clean. Pager, page-size, sort and search links keep the filters, and the selection is unchanged. An empty list says that no records match the filters (and the search, if there is one).

While any filter is on, a chip per filter sits under the toolbar (the Theme's `ActiveFilters`, which `Toolbar` composes), such as "Cuisine: Italian", "Difficulty: Easy, Medium", "Name contains piz", "Prep time (min) ≥ 10" or "Vegetarian: Yes", with dates as the list shows them (in UTC, a datetime with its time unless it is midnight) and a Reference by its record's Record title, such as "Author: Alan Turing". Its × is a plain link that removes only that filter, starting again at page 1 and keeping the search, the sort, the page size and every other filter, so it works without JavaScript. Every filter in the URL gets a chip, whatever its operator and even on a hidden Field, so a person can always see and remove what narrows the list.

A replaced list View reads `createListView(...).filterControls`, `filterForm`, `filterCount`, `activeFilters` (each with its `field`, `operator`, `value`, `label` and removal `href`), `clearFiltersHref` and `applyFilters(formData)`. `activeFilters` is a promise, since a Reference filter's label is looked up: await it, as the Theme's `ActiveFilters` does with `$derived(await view.activeFilters)`, so the chips render during SSR. The same chips are on the shared entry as `await activeFilters(url, resource, admin)`; without the admin, a Reference filter is labelled by its id.

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

The bundled REST Provider sends the filters in the same encoding, after `q`: `GET {base}/{resource}?page=1&perPage=25&difficulty=Easy&difficulty=Hard&prepTimeMinutes.gte=10&vegetarian=true`. Values go in the Field's own type rather than as the filter input writes them: an ISO date or datetime string as it is (`publishedAt.gte=2024-03-01T00:00:00.000Z`), and a `Date` as an ISO string. A backend that can't do a declared filter should answer 400. The REST Provider's `getMany` uses the same encoding for a filter on `id` (see [References](#references)). The demo backend filters any Resource before searching and paging: `eq` and `in` match the value exactly, `contains` ignores case, and the range operators compare numbers as numbers and ISO strings as text. In the demo, recipes filter by name (`contains`), cuisine (narrowed to `eq` and `in`), difficulty, prep time, vegetarian and published date; users by role, active and joined date; and posts by author (a Reference, so one user id, `eq`) and status.

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

### Export

With JavaScript, the list View's toolbar has "Export CSV" (the Theme's `ExportButton`, which `Toolbar` composes, so a replaced list View that uses `Toolbar` gets it too). It downloads every record that matches the list's current search, sort and filters, on every page, not just the one shown, as `{resource}-{YYYY-MM-DD}.csv`. While it runs the button reads "Exporting…" and is disabled. An export stops at a cap, 10,000 records by default, and then says so beside the button: "Exported the first 10,000 of 12,345 records", or without the total for a Provider that can't count. A failed export downloads nothing: the reason shows beside the button, which becomes "Try again". Without JavaScript there is no button, since export is a remote command: a command can't set download headers, so the browser builds the file from the text it returns.

`serveResource` returns `exportList`, a remote command, which the app's `.remote.ts` re-exports with the rest. It takes the list params without the page and the page size (`ExportParams<R>`: the search, the sort and the filters), checked by the same rules as `getList`'s, and gets the Resource's `defaultSort` when it names no sort. It pages through the Provider's `getList` on the server, in pages of `MAX_PER_PAGE` (or of the cap, when that is smaller), parsing each page with the Resource schema as `getList` does, until the last page (the `total` is reached, `hasNextPage` is false, or a page comes back short) or the cap. So it works the same for a Provider that counts and one that doesn't, and needs no Provider code of its own. It returns `{ csv, rows, capped }`, plus `total` when the Provider gave one. A Provider error on any page fails the whole export with that error's status and message, as on reads; there is never a partial file. Set the cap with `serveResource`'s optional third argument:

```ts
export const { getList, getOne, lookup, create, update, deleteOne, deleteMany, exportList } =
	serveResource(posts, postsProvider, { maxExportRows: 50 });
```

The file has one column per Field the detail View shows (every Field that isn't hidden), in schema order, headed by the Field's label. Text is written as it is, numbers as plain decimals (never with an exponent), booleans as `true` and `false`, dates as ISO strings, lists of scalars joined with `, `, and objects (or lists of them) as JSON; a missing value is an empty cell. Every cell is quoted, with `"` doubled, every row ends with CRLF (RFC 4180), and the file starts with a UTF-8 byte order mark, so a spreadsheet shows accented text correctly. A text cell (a header, or a list joined as text, included) that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a `'` in front, so opening the file can never run a formula. Numbers are never prefixed, so `-5` stays a number.

A replaced list View calls `createListView(...).exportCsv()`, which never rejects: it resolves to `{ ok: true, rows, capped, total? }` after starting the download, or `{ ok: false, message, status? }` with a message that is safe to show. The writer and the pager are pure modules on `@svelte-admin/core/export`, as `toCsv(resource, records)` and `collectPages(getPage, maxRows)`, so they are unit-tested on their own. They are server-only: the client bundle check fails if the CSV writer reaches the client build. In the demo, posts cap their export at 50, so with the 60 seeded posts the cap shows.

## Kinds and References

### References

A Reference is a Field that holds the id of a record of another Resource, its target. Declare one with `ref` in `field()`, a function that returns the target:

```ts
import { users } from './users.ts';

export const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({
		id: z.number(),
		title: z.string(),
		userId: field(z.number(), { label: 'Author', ref: () => users, filterable: true })
	})
});
```

The Field is of the built-in Kind `reference`. Its type, without `.optional()`, `.nullable()` or `.default()` (which keep the Reference on either side), must be the target's id type: TypeScript rejects `field(z.string(), { ref: () => users })` when users have number ids, and a Reference whose type isn't a string or a number. `ref` is a function so that `defineResource` never calls it, and two Resources can import each other. A Resource that references itself names the arrow's return type, `ref: (): Resource => comments`, so TypeScript needn't infer the Resource from its own initializer.

The list and detail Views show a Reference as its target record's Record title, linked to that record's detail View (`/admin/users/3`). A target record that doesn't exist, or a lookup that fails, shows the raw id, muted, with "(not found)" for screen readers: a Reference never fails the View. Both resolve during SSR, so they work without JavaScript. The core's `createListView(...).reference(field, value)` and `createDetailView(...).reference(field, value)` give a replaced View the same `{ title, href }`, or `undefined` for an empty value, a missing record or a failed lookup, and the shared entry has it as `resolveReference(admin, field, value)`. The Theme's `FieldCell` and `FieldValue` take the `record` and the `admin` beside the Field and its value; without the admin they show a Reference's raw id.

The Views look a target record up with its Resource's `lookup`, the eighth remote function `serveResource` returns, so every `.remote.ts` re-exports it, including those of Resources nothing references yet. It is a batched query: every `lookup` a page makes in the same tick is one request to the app's server, which asks the target's Provider for the distinct ids it names:

- With the Provider's optional `getMany(ctx, ids)`, in one call per 100 distinct ids. `ids` holds 1 to 100 distinct ids with the schema's id type, so the Provider never parses or deduplicates. It returns the records it found, in any order, and leaves out the missing ones: a missing record is not an error, and its id resolves to `null`. Like the other methods, it is typed from the Resource (`ResourceProvider<R>`), so a `getMany` that takes another id type is a type error.
- Without it, with `getOne` once per id, so a Provider needs no new code for References. A `NotFoundError` resolves its id to `null`.

Either way, each record is parsed with the target's schema, as `getOne` does, and a record for an id that wasn't asked for is ignored. Any other Provider error fails the whole batch with its status. `lookup` takes one id of the Resource's id type, and the server rejects any other before the Provider runs.

The bundled REST Provider has `getMany`: it asks the list for one page as large as the ids, filtered by `id` with the list encoding's `in` filter, `GET {base}/{resource}?page=1&perPage=3&id=7&id=3&id=12` (a repeated param, even for one id). The backend answers as for any list, leaving out the ids it has no record for. A backend that can't filter its list by `id` should use a Provider without `getMany`, so the admin falls back to `getOne`: pick the REST Provider's other methods, as the demo's posts Provider does in `src/lib/server/posts-provider.ts`.

A Reference can be `filterable`, with `eq` only: `getList` receives `{ field: 'userId', operator: 'eq', value: 3 }`, with the value typed as the target's id, and the list URL writes it as a bare param, `?userId=3`. A number id is read by the same rule as a route param, so `userId=3a` or `userId=03` is dropped. A Reference can't be `sortable`, since its order would be its ids'. The filter panel chooses the record by name (see [The Reference filter](#the-reference-filter)).

#### The Reference picker

On the create and edit Views, a person chooses a Reference's record by its Record title, with the Theme's `ReferencePicker`. The server renders a plain `<select>`, so it works without JavaScript: the target's first 50 records in its default order (its `defaultSort`), plus the current record when it isn't among them, after "—" (or "Choose…" when the Reference is required). A current id that names no record is listed as itself, "(not found)". Once hydrated, the picker becomes a combobox, following the ARIA combobox pattern: a text input that shows the current record's title, over a listbox of records. Typing searches the target after a 300 ms pause, as the list search does: a `searchable` target is asked for the first 50 records matching the text, and any other target's first 50 records are filtered by title in the browser. The arrow keys move through the records, Enter chooses one, and Escape closes the list. Emptying the text clears the choice. Both forms send the chosen id under the Field's name, and show the Field's label, help text and issues like any input, a backend's issue too (in the demo, a post whose author is no user is refused with a 422 on `userId`).

The form spec of a Reference is `{ kind: 'reference', target: 'users', id: 'number' }`, beside the label and the rest. The picker sends the id as text, and `formSchema` turns it into the target's id type by the rule a route param is read by: `'3'` is `3`, while `'3a'` or `'03'` is invalid input. An empty picker means no value, so a required Reference reports "Required", and an optional one is cleared on save. The edit form's prefill writes the id as text, and `FormInput` types a Reference by the target's id type. A read-only Reference shows on the edit View as its record's title, as on the detail View.

The headless part is the core's `createReferencePicker(admin, field, current)`, for a Reference Field or a Reference input's spec and its current value (the typed id, or the id as text). It gives:

- `target`, the target Resource;
- `title`, the current record's Record title through the target's `lookup` (`undefined` for no choice, a missing record or a failed lookup);
- `options`, the `<select>`'s options without JavaScript: `{ id, title }` for the first 50 records, plus the current one (marked `missing: true` when it names no record);
- `search(text)`, the `{ id, title }` of at most 50 records whose title matches.

It reads the target through the admin, with the target's `getList` and `lookup`, so it works during SSR. A form View gives one per Reference input: `createFormView(...).picker('userId')`, with what the input holds now as the current value. The form View also has `admin`, which the Theme's `FieldInput` takes to render a Reference with `ReferencePicker` (without it, it falls back to an input for the id itself).

A replaced create or edit View renders a Reference with the Theme's `ReferencePicker`, given the admin, the Reference's spec and its typed input:

```svelte
<ReferencePicker {admin} spec={specOf('userId')} field={view.form.fields.userId} />
```

The demo's replaced posts create View chooses its author this way.

#### The Reference filter

A filterable Reference gets a `ReferencePicker` in the list View's filter panel, so a person filters posts by author by choosing the author by name: a `<select>` in the GET form without JavaScript, the combobox once hydrated, both sending the id under the Field's key, as in `?userId=3`. Its empty choice is "Any", which sends an empty value, so the list ignores it as it does any blank control. Like the other controls, it starts again at page 1 and keeps the search, the sort and the page size. The picker shows the record the list is filtered by, and follows the URL: removing the filter's chip clears it. The chip names the record by its Record title, "Author: Alan Turing", looked up with the target's `lookup` during SSR; a record that doesn't exist (or a failed lookup) leaves the id, as in "Author: 99", and the list is still filtered by it, so an old link keeps working.

In the core, `createListView(...).filterControls` holds a `reference` control for it: `{ type: 'reference', field, operators: ['eq'], current: { name, value }, emptyLabel: 'Any', picker }`, where `current` is the input's name and the id the list is filtered by now (or empty), `emptyLabel` names the choice that filters nothing, and `picker` is a `createReferencePicker` for that id. A replaced list View renders it with the Theme's part, given the control in place of a form's spec and input:

```svelte
{#if control.type === 'reference'}
	<ReferencePicker filter={control} />
{/if}
```

The startup checks name the Resource and the Field:

- `defineResource` throws for a sortable Reference, a filter operator other than `eq`, a `ref` inside a nested object or a list (only a top-level Field can be a Reference), a Reference whose type isn't a string or a number, and a `recordTitle` that names a Reference.
- `defineAdmin` throws when a Reference's target isn't in `admin.ts`, or `admin.ts` lists another Resource object under the target's name.

In the demo, a post's author is a Reference to users, and one seeded post (57) names a user that doesn't exist. Users use the REST Provider's `getMany`, so a page of posts looks its authors up with one `GET /users?…&id=…` request. A post may also reply to another, through `replyToId`, an optional self-Reference to posts (`ref: (): Resource => posts`); the posts Provider has no `getMany`, so the replied-to posts are looked up with one `GET /posts/{id}` each. A few seeded posts reply to others.
