# Comparable admin frameworks and the gap

Research for PER-7 (map PER-6, "Svelte Admin direction review"). Researched 2026-11-13.

**Question.** What do established admin frameworks offer, and what gap would a SvelteKit-native, schema-first Admin framework fill?

**Measured against the map's core promise.** "Define a Resource with a Zod schema and a Provider, and get a type-safe CRUD admin in SvelteKit: list, detail, create, edit and delete, with server-side pagination, search, sort and filter."

Terms follow `CONTEXT.md`: **Admin framework**, **Resource**, **Field**, **Provider**, **Dashboard**. Where a framework uses its own word, it is given in quotes the first time.

## Summary

| | react-admin | Refine | Filament | Django admin | Svelte options |
|---|---|---|---|---|---|
| Stack | React SPA | React, headless | Laravel + Livewire | Django (server-rendered) | Svelte 5 / SvelteKit |
| Resource | `<Resource>` JSX element | `resources` config array | PHP class per Eloquent model | `ModelAdmin` per Django model | svadmin: config object; Orbitale: `CrudDefinition` |
| Provider | `dataProvider` (9 methods) | `dataProvider` + 7 other providers | None: Eloquent directly | None: Django ORM directly | svadmin: `DataProvider` |
| Source of Fields | Hand-written JSX | Hand-written JSX | Hand-written PHP (can scaffold from DB) | Derived at runtime from the model | Hand-written field config |
| Schema drives UI? | No (Zod only validates) | No | No (DB columns, scaffold time only) | **Yes** (model fields, at runtime) | No |
| Inference / scaffolding | Guessers, dev-only, from sample data | Inferencer, dev-only, from sample data | `make:filament-resource --generate` | Not needed | svadmin Inferencer (sample data / OpenAPI) |
| Server-side list ops | Yes, through Provider | Yes, default `mode: "server"` | Yes, on the Eloquent query | Yes | svadmin: via Provider |
| Maturity | High (since 2015) | High | High | Very high | Low: early or abandoned |

**The gap, in one line.** The only framework where the schema itself drives list, detail and form at runtime is Django admin, and it is tied to the Django ORM. The JavaScript frameworks all ask you to declare Fields a second time next to your validation schema, and all of them are client-rendered SPAs. Nothing mature exists for Svelte, and nothing at all uses a Zod schema as the single source of truth for a SvelteKit-native (load / form actions / remote functions) admin.

## react-admin

**Core concepts.** An `<Admin>` root takes a `dataProvider` (required), `authProvider`, `i18nProvider`, `layout`, `theme` and `dashboard` [1]. Each `<Resource name="posts">` child defines CRUD routes (`/posts`, `/posts/create`, `/posts/:id`, `/posts/:id/show`) and takes `list`, `create`, `edit` and `show` view components plus `recordRepresentation` [2]. The `name` is passed to the data provider, which maps it to an API endpoint [2].

**Provider.** The data provider interface is `getList`, `getOne`, `getMany`, `getManyReference`, `create`, `update`, `updateMany`, `delete`, `deleteMany` [3]. `getList(resource, { pagination: { page, perPage }, sort: { field, order }, filter, meta, signal })` returns `{ data, total?, pageInfo? }`; `pageInfo` supports partial pagination when the total is unknown [4]. The docs list about 64 community and official data providers (Supabase, Prisma, GraphQL, Firebase, ...) [5].

**How lists and forms are derived.** By hand. Fields are JSX children (`<TextInput source="name" />`). Zod and Yup are supported only as a react-hook-form `resolver` on `<SimpleForm>`: the schema validates, but inputs are still declared separately [6]. `<ListGuesser>` / `<EditGuesser>` infer Fields from fetched data and print code to the console to copy; the docs say "Do not use the guessers in production" [7].

**Generated code vs runtime config.** Runtime configuration in JSX; guessers are a dev-time copy-paste aid [7].

**Extension points.** Custom views per Resource, custom `layout`, `theme`, `dashboard`, auth and i18n providers, custom routing [1][2].

**Maturity.** Published on npm since 2015; latest `react-admin` 5.15.7; about 215k weekly downloads [8]. Maintained by Marmelab.

**SSR.** Effectively a client-side SPA: default hash router "working without a server"; SSR is only mentioned as a reason to swap the router [1].

## Refine

**Core concepts.** "Refine itself is headless" with UI integrations for Ant Design, Material UI, Chakra UI, Mantine (and shadcn/ui) and router integrations for React Router, Next.js, Remix and Expo Router [9]. Providers: data, auth, access control, notification, i18n, live, router, audit log [9]. The `<Refine resources={[...]}>` array is "the main building block"; each entry has `name`, `identifier`, `list`/`create`/`edit`/`show` (route paths by default, or components) and free-form `meta` [10].

**Provider.** Required methods: `getList`, `getOne`, `create`, `update`, `deleteOne`, `getApiUrl`; optional: `getMany`, `createMany`, `updateMany`, `deleteMany`, `custom` [11]. `getList` takes `pagination`, `sorters`, `filters` (typed `CrudFilters`, with operators such as `eq`, `contains` and `or` groups) and `meta`, and always returns `{ data, total }` [11][12].

**How lists and forms are derived.** By hand, using hooks (`useTable`, `useForm`, ...). `useTable` defaults pagination, sorting and filtering to `mode: "server"` [12]. The `@refinedev/inferencer` package fetches sample records, infers Field types and renders code "to copy and paste"; it is experimental and "not meant to be used in production" [13].

**Generated code vs runtime config.** Runtime config for Resources; view code is hand-written or copied from the Inferencer [13].

**Extension points.** Every provider is swappable; UI is fully replaceable because it is headless [9].

**Maturity.** `@refinedev/core` 5.0.12, about 443k weekly downloads [8]. React only.

## Filament (Laravel)

**Core concepts.** Built on Laravel, Livewire, Alpine.js and Tailwind; packages for panels, forms, tables, actions, infolists (read-only detail), notifications and widgets (the Dashboard) [14]. A resource is a "static class used to build CRUD interfaces for your Eloquent models" [15].

**Provider.** None as such: data access is the Eloquent model. Table queries can be scoped with `modifyQueryUsing()` and `getEloquentQuery()` [16].

**How lists and forms are derived.** `php artisan make:filament-resource Customer` generates a resource class, `List/Create/Edit` page classes, a form schema class and a table class. `--generate` fills the form and table from the model's database columns; the result is ordinary code you then edit [15]. Columns opt in with `->searchable()` and `->sortable()`, which apply `where` / `orderBy` to the Eloquent query [17]; tables provide filtering, sorting and pagination [14].

**Generated code vs runtime config.** Generated code (scaffolding), then a fluent PHP builder API at runtime. The schema is read once at scaffold time; later model changes are not picked up automatically [15].

**Extension points.** Custom columns, fields, actions, pages and widgets; "hundreds" of community plugins as Composer packages [14][17].

**Maturity.** `filament/filament` v5.11.3 (released 2026-11-13), about 6.5M monthly / 49.6M total Packagist installs [18].

## Django admin

**Core concepts.** Register a model with `@admin.register(Model)` on a `ModelAdmin` subclass, or plain `admin.site.register(Model)` for defaults [19]. List options: `list_display`, `list_display_links`, `list_editable`, `search_fields` (`icontains` by default, `^`/`=`/`@` prefixes), `list_filter`, `ordering`, `list_per_page` (default 100) [19]. Form layout: `fields`, `fieldsets`, `readonly_fields` [19].

**Provider.** None: the Django ORM, restricted via `get_queryset(request)` [19].

**How lists and forms are derived.** At runtime from the model: "By default a `ModelForm` is dynamically created for your model"; without `fields`/`fieldsets` it shows every editable non-`AutoField` field in model order [19]. This is the closest existing match to "schema in, CRUD out".

**Generated code vs runtime config.** Pure runtime configuration; no code generation.

**Extension points.** `get_queryset`, `formfield_for_foreignkey` / `_manytomany` / `_choice_field`, `save_model` / `delete_model`, `get_urls()` for custom views, `has_*_permission`, overridable templates, admin actions, custom `AdminSite` [19].

**Stated limits.** "The admin's recommended use is limited to an organization's internal management tool. It's not intended for building your entire front end around." [19]

**Maturity.** Part of Django itself; current Django release on PyPI is 6.1.3 [20].

## Svelte / SvelteKit options

No mature option exists. What was found:

- **svadmin** (`@svadmin/core`, repo `vibeunion/svadmin`). "Headless admin framework for Svelte 5 — bring your own backend" [21]. The closest in shape to Refine: DataProvider, AuthProvider, RouterProvider, LiveProvider; AutoTable, AutoForm, an Inferencer from sample data or OpenAPI; a `@svadmin/sveltekit` router package and an SSR-first `@svadmin/lite` [22][23]. Resources are plain `ResourceDefinition` objects with a hand-written `fields` array (`{ key, label, type, required, searchable }`) [21]; Zod is not mentioned in its README or docs [21][22][23]. The main `<AdminApp>` defaults to a hash router, i.e. a client-side app [21]. Maturity: first npm publish 2026-03-22, version 0.81.1, about 2.4k weekly downloads, 6 GitHub stars at time of reading [8][21]. Its comparison page is self-published [23]. Young and pre-1.0; not a basis to depend on yet.
- **Orbitale SvelteAdmin** (`@orbitale/svelte-admin`). "Crud pages system for Svelte projects (alpha)" with `DashboardDefinition`, `CrudDefinition`, operations, `TextField`-style Field classes and callback state providers; README: "it's a prototype" [24]. Last npm publish 2024-09-22 (0.18.0), about 22 weekly downloads [8]. Effectively dormant.
- **djhi/svelte-admin**. "An experiment (for now) to build an equivalent of react-admin for svelte"; a single app, not a library; roadmap's first item "Have the basic core features implemented" [25]. Not usable.
- **svelte-admin-components**. Last publish 2023-04-13, 3 weekly downloads [8]. Abandoned.
- **Adjacent building blocks, not admin frameworks.** `sveltekit-superforms` (Zod-validated SvelteKit forms with load + form actions; its docs include a single-page CRUD tutorial; about 400k weekly downloads) [8][26]. `autoform-svelte` (forms generated from Zod or JSON Schema for Svelte 5 with shadcn-svelte theming; forms only) [27]. Admin *templates* such as Flowbite Svelte Admin or shadcn-svelte blocks are UI starters with no Resource or Provider model.

## What is missing for SvelteKit today

Against the promise "Define a Resource with a Zod schema and a Provider, and get a type-safe CRUD admin in SvelteKit: list, detail, create, edit and delete, with server-side pagination, search, sort and filter":

1. **Schema as the single source of truth.** react-admin and Refine use Zod only to validate a form whose inputs you declare separately [6]; svadmin declares Fields in its own config shape [21]. Only Django admin derives forms and lists from the model at runtime [19], and Filament reads the schema once at scaffold time [15]. No JS or Svelte framework derives list columns, detail view and form Fields from a Zod schema at runtime, with per-Field overrides layered on top. This is the core gap.
2. **SvelteKit-native data flow.** react-admin, Refine and svadmin's main app are client-side SPAs calling a Provider from the browser [1][21]. None run Provider calls in SvelteKit `load` functions, form actions or remote functions, so none get SSR'd lists, progressive-enhancement forms, or server-only Provider credentials for free. SvelteKit's remote functions (`query`, `form`, `command`) take a Standard Schema such as Zod for validation, but are still experimental behind `experimental.remoteFunctions` [28]; a framework built on them would need to track that.
3. **End-to-end types from one schema.** The schema should type the record, the form values, the Provider's methods and the allowed sort/filter keys. react-admin's `filter` is `any` [4]; Refine's filters are typed but not tied to a schema [11].
4. **A mature, maintained Svelte option at all.** The Svelte candidates are either dormant (Orbitale, djhi, svelte-admin-components) or less than a year old and pre-1.0 (svadmin) [8][21][24][25].
5. **Server-side list operations as a first-class contract.** Every mature framework already does pagination, search, sort and filter on the server [4][12][17][19]; the promise only matches the baseline here, so the Provider contract should match theirs (page + perPage, sort field/order, typed filters, `total` or `pageInfo`).

What the established frameworks suggest copying: a small, swappable Provider interface (react-admin's 9 methods or Refine's 6 required ones) [3][11]; a "guesser"-free default that is good enough for production, as Django shows is possible [19]; and generous escape hatches (custom views, custom Fields, query scoping) [2][16][19].

## Sources

1. react-admin, `<Admin>`: https://marmelab.com/react-admin/Admin.html
2. react-admin, `<Resource>`: https://marmelab.com/react-admin/Resource.html
3. react-admin, Data Providers: https://marmelab.com/react-admin/DataProviders.html
4. react-admin, Writing a Data Provider: https://marmelab.com/react-admin/DataProviderWriting.html
5. react-admin, Supported Data Providers: https://marmelab.com/react-admin/DataProviderList.html
6. react-admin, Validation: https://marmelab.com/react-admin/Validation.html
7. react-admin, `<ListGuesser>`: https://marmelab.com/react-admin/ListGuesser.html
8. npm registry metadata and npm downloads API (last week, 2026-11-06 to 2026-11-12) for `react-admin`, `@refinedev/core`, `@svadmin/core`, `@orbitale/svelte-admin`, `svelte-admin-components`, `sveltekit-superforms`: https://registry.npmjs.org/ and https://api.npmjs.org/downloads/point/last-week/
9. Refine, General Concepts: https://refine.dev/docs/guides-concepts/general-concepts/
10. Refine, `<Refine>` component (`resources`): https://refine.dev/docs/core/refine-component/
11. Refine, Data Provider: https://refine.dev/docs/data/data-provider/
12. Refine, `useTable`: https://refine.dev/docs/data/hooks/use-table/
13. Refine, Inferencer: https://refine.dev/docs/packages/inferencer/
14. Filament, Introduction: https://filamentphp.com/docs/5.x/introduction/overview
15. Filament, Resources overview: https://filamentphp.com/docs/5.x/resources/overview
16. Filament, Listing records: https://filamentphp.com/docs/5.x/resources/listing-records
17. Filament, Table columns: https://filamentphp.com/docs/5.x/tables/columns/overview
18. Packagist, `filament/filament` versions and stats: https://repo.packagist.org/p2/filament/filament.json and https://packagist.org/packages/filament/filament/stats.json
19. Django, The Django admin site (5.2 docs): https://docs.djangoproject.com/en/5.2/ref/contrib/admin/
20. PyPI, Django: https://pypi.org/pypi/Django/json
21. svadmin repository and README: https://github.com/vibeunion/svadmin
22. svadmin, Introduction: https://svadmin.pages.dev/guides/introduction/
23. svadmin, Comparison (self-published): https://svadmin.pages.dev/guides/comparison/
24. Orbitale SvelteAdmin: https://github.com/Orbitale/SvelteAdmin
25. djhi/svelte-admin: https://github.com/djhi/svelte-admin
26. Superforms, CRUD tutorial: https://superforms.rocks/crud
27. autoform-svelte: https://convex-works.github.io/autoform-svelte
28. SvelteKit, Remote functions: https://svelte.dev/docs/kit/remote-functions

GitHub star counts and last-commit dates for the established frameworks could not be fetched from this environment (GitHub API blocked); package-registry figures are used for maturity instead.
