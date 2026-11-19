# Add the admin to a SvelteKit app

This guide takes an existing SvelteKit app to a working admin, one file at a time, in the order you write them, and then to its next Resource. It mounts the admin under `/admin`, as the demo app does. [Mounting at `/`](#mounting-at-) shows what changes when the admin is the whole app, and [Replacing a View](#replacing-a-view) is the way out when a stock View doesn't fit.

Every file below is quoted whole from the demo (`apps/demo`), under its path there, never as an excerpt. The demo's files are the source of truth. CI runs `bun run check:docs`, which fails when a quote here differs from the file the demo runs. So what you copy is what works. The terms (Resource, View, Field, Kind, Theme, Provider) are the ones in [`CONTEXT.md`](../CONTEXT.md).

## Before you start

The admin is built on features that are still experimental: remote functions in SvelteKit and async Svelte. It needs the exact versions this workspace pins in the `catalog` of the root `package.json`: SvelteKit 3.2, Svelte 5.57, Vite 8, Tailwind CSS 4 and Zod 4, on Node 22.

The packages aren't published, so for now your app is a member of this bun workspace, as the demo is. See [Before npm](#before-npm).

Beside them, the demo depends on `zod` and `@lucide/svelte` (for its icons), and on `@sveltejs/adapter-node`, `@tailwindcss/vite` and `tailwindcss` for its build. See `apps/demo/package.json` for the full list.

The demo's modules import each other as `#lib/admin.ts`, not `$lib/admin`. Its `package.json` maps `"imports": { "#lib/*": "./src/lib/*" }`, a Node subpath import. [`params.ts`](#4-paramsts) says why.

## 1. The Vite config

SvelteKit 3 takes its config in `vite.config.ts`, through `sveltekit({...})`. The admin needs two experimental flags there: `experimental.remoteFunctions`, since each Resource serves its records through remote functions, and `compilerOptions.experimental.async`, since every View route awaits its Resource in the markup. Add the Tailwind plugin too, for the Theme's classes. The demo builds with `adapter-node`.

<!-- demo: vite.config.ts -->

```ts
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			experimental: { remoteFunctions: true },
			compilerOptions: { experimental: { async: true } }
		})
	]
});
```

## 2. The stylesheet

The Theme ships Tailwind classes, not CSS, so your app compiles them with its own Tokens. The stylesheet does three things:

- `@import 'tailwindcss'` turns Tailwind on.
- The `@source` line tells Tailwind to scan the Theme's package for the classes it uses. Its path is relative to the stylesheet.
- The Tokens are shadcn's CSS variables, for light mode in `:root` and for dark mode in `.dark`, mapped to Tailwind's colours in `@theme inline`. Change their values to restyle the whole admin.

<!-- demo: src/app.css -->

```css
@import 'tailwindcss';

/* The Theme ships Tailwind classes, not CSS: compile them with this app's tokens. */
@source '../node_modules/@svelte-admin/theme-shadcn/src';

@custom-variant dark (&:is(.dark *));

:root {
	--radius: 0.625rem;
	--background: oklch(1 0 0);
	--foreground: oklch(0.129 0.042 264.695);
	--card: oklch(1 0 0);
	--card-foreground: oklch(0.129 0.042 264.695);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.129 0.042 264.695);
	--primary: oklch(0.208 0.042 265.755);
	--primary-foreground: oklch(0.984 0.003 247.858);
	--secondary: oklch(0.968 0.007 247.896);
	--secondary-foreground: oklch(0.208 0.042 265.755);
	--muted: oklch(0.968 0.007 247.896);
	--muted-foreground: oklch(0.554 0.046 257.417);
	--accent: oklch(0.968 0.007 247.896);
	--accent-foreground: oklch(0.208 0.042 265.755);
	--destructive: oklch(0.577 0.245 27.325);
	--border: oklch(0.929 0.013 255.508);
	--input: oklch(0.929 0.013 255.508);
	--ring: oklch(0.704 0.04 256.788);
	--chart-1: oklch(0.646 0.222 41.116);
	--chart-2: oklch(0.6 0.118 184.704);
	--chart-3: oklch(0.398 0.07 227.392);
	--chart-4: oklch(0.828 0.189 84.429);
	--chart-5: oklch(0.769 0.188 70.08);
	--sidebar: oklch(0.984 0.003 247.858);
	--sidebar-foreground: oklch(0.129 0.042 264.695);
	--sidebar-primary: oklch(0.208 0.042 265.755);
	--sidebar-primary-foreground: oklch(0.984 0.003 247.858);
	--sidebar-accent: oklch(0.968 0.007 247.896);
	--sidebar-accent-foreground: oklch(0.208 0.042 265.755);
	--sidebar-border: oklch(0.929 0.013 255.508);
	--sidebar-ring: oklch(0.704 0.04 256.788);
}

.dark {
	--background: oklch(0.129 0.042 264.695);
	--foreground: oklch(0.984 0.003 247.858);
	--card: oklch(0.208 0.042 265.755);
	--card-foreground: oklch(0.984 0.003 247.858);
	--popover: oklch(0.208 0.042 265.755);
	--popover-foreground: oklch(0.984 0.003 247.858);
	--primary: oklch(0.929 0.013 255.508);
	--primary-foreground: oklch(0.208 0.042 265.755);
	--secondary: oklch(0.279 0.041 260.031);
	--secondary-foreground: oklch(0.984 0.003 247.858);
	--muted: oklch(0.279 0.041 260.031);
	--muted-foreground: oklch(0.704 0.04 256.788);
	--accent: oklch(0.279 0.041 260.031);
	--accent-foreground: oklch(0.984 0.003 247.858);
	--destructive: oklch(0.704 0.191 22.216);
	--border: oklch(1 0 0 / 10%);
	--input: oklch(1 0 0 / 15%);
	--ring: oklch(0.551 0.027 264.364);
	--chart-1: oklch(0.488 0.243 264.376);
	--chart-2: oklch(0.696 0.17 162.48);
	--chart-3: oklch(0.769 0.188 70.08);
	--chart-4: oklch(0.627 0.265 303.9);
	--chart-5: oklch(0.645 0.246 16.439);
	--sidebar: oklch(0.208 0.042 265.755);
	--sidebar-foreground: oklch(0.984 0.003 247.858);
	--sidebar-primary: oklch(0.488 0.243 264.376);
	--sidebar-primary-foreground: oklch(0.984 0.003 247.858);
	--sidebar-accent: oklch(0.279 0.041 260.031);
	--sidebar-accent-foreground: oklch(0.984 0.003 247.858);
	--sidebar-border: oklch(1 0 0 / 10%);
	--sidebar-ring: oklch(0.551 0.027 264.364);
}

@theme inline {
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--color-chart-1: var(--chart-1);
	--color-chart-2: var(--chart-2);
	--color-chart-3: var(--chart-3);
	--color-chart-4: var(--chart-4);
	--color-chart-5: var(--chart-5);
	--color-sidebar: var(--sidebar);
	--color-sidebar-foreground: var(--sidebar-foreground);
	--color-sidebar-primary: var(--sidebar-primary);
	--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
	--color-sidebar-accent: var(--sidebar-accent);
	--color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
	--color-sidebar-border: var(--sidebar-border);
	--color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
	* {
		@apply border-border outline-ring/50;
	}
	body {
		@apply bg-background text-foreground;
	}
}
```

Import it once from your root layout, `src/routes/+layout.svelte`, with `import '../app.css';`. The demo's root layout isn't quoted here, because the rest of it is only for the demo's tests (see [Files only the demo needs](#files-only-the-demo-needs)).

## 3. `admin.ts`

`admin.ts` is the one place every Resource is mounted. `defineAdmin` takes the base path the admin lives under and the Resources, by the name each one has in its URLs. Each Resource is its shared module (its schema and settings, safe for the browser) and a lazy import of its remote module (its remote functions, which run on the server). The order here is the sidebar's order, and the first Resource is where the admin's index leads.

The base path is `/`, or starts with `/` and doesn't end with one, or `defineAdmin` throws at startup. Keep it in step with the folder the admin's routes live in: `/admin` here, so the routes below sit in `src/routes/admin`.

`kinds` registers the demo's own Kinds. An app that has none leaves it out. See [Kinds](../README.md#kinds) in the README for what a Kind is and how to register one.

<!-- demo: src/lib/admin.ts -->

```ts
import { defineAdmin, type ResourceNameOf } from '@svelte-admin/core';
import { numberOrSlugFromInput, numberOrSlugToInput } from '#lib/kinds/number-or-slug.ts';
import { posts } from '#lib/resources/posts.ts';
import { recipes } from '#lib/resources/recipes.ts';
import { users } from '#lib/resources/users.ts';

export const admin = defineAdmin({
	basePath: '/admin',
	resources: {
		recipes: { resource: recipes, remote: () => import('#lib/resources/recipes.remote.ts') },
		posts: { resource: posts, remote: () => import('#lib/resources/posts.remote.ts') },
		users: { resource: users, remote: () => import('#lib/resources/users.remote.ts') }
	},
	// Each component is a lazy import, as a Resource's icon is: this module loads in plain Node.
	kinds: {
		// The app's own Kind, which recipes' rating names (declared in `kinds/kinds.d.ts`).
		stars: {
			input: () => import('#lib/kinds/StarsInput.svelte'),
			cell: () => import('#lib/kinds/Stars.svelte'),
			display: () => import('#lib/kinds/Stars.svelte')
		},
		// The app's Kind for recipes' source id, a number or a slug: a text input, and the
		// conversions between what it sends and the Field's value.
		numberOrSlug: {
			input: () => import('#lib/kinds/NumberOrSlugInput.svelte'),
			fromInput: numberOrSlugFromInput,
			toInput: numberOrSlugToInput
		},
		// The built-in boolean Kind's cell, replaced for every boolean Field: ✓ and ✗ in the list
		// View. Its display and input stay the Theme's.
		boolean: { cell: () => import('#lib/kinds/BooleanCell.svelte') }
	}
});

export type ResourceName = ResourceNameOf<typeof admin>;
```

`ResourceName` is the union of the mounted names, for app code that names a Resource.

The Resource modules themselves (`users.ts` and `users.remote.ts`, for one) come in [Adding a Resource](#10-adding-a-resource).

## 4. `params.ts`

Each View route has a `[resource=resource]` segment, and `params.ts` defines its matcher: `admin.matchResource` accepts only the names `admin.ts` mounts, so any other name is a 404 before a route loads, and a route of your own beside the admin's keeps working.

<!-- demo: src/params.ts -->

```ts
import { defineParams } from '@sveltejs/kit/params';
import { admin } from '#lib/admin.ts';

export const params = defineParams({ resource: admin.matchResource });
```

SvelteKit loads `params.ts` in plain Node at build time, with a plain `import()`, outside Vite. So `admin.ts`, and every module it imports eagerly, must load there too: no `$lib` or `$app` imports, which only Vite resolves, and no `.svelte` file, which Node can't load. That is why `admin.ts` imports with `#lib`, and why the remote modules, the Kinds' components and the Resources' icons are lazy imports (`() => import(...)`).

## 5. `hooks.server.ts`

One line. `adminHooks(admin)` returns a `handleError` that logs unexpected errors and remote function validation failures, and shows the user only a safe message. It also hands the admin's Kinds to the server's forms, so a Kind's conversions run on the server too.

<!-- demo: src/hooks.server.ts -->

```ts
// Unexpected errors and remote function validation failures are logged, and the user sees only
// a safe message. The admin's Kinds reach the server's forms here, so a Kind's `fromInput` (such
// as recipes' source id) converts on the server too, even for a form posted right after a restart.
import { adminHooks } from '@svelte-admin/core/hooks';
import { admin } from '#lib/admin.ts';

export const { handleError } = adminHooks(admin);
```

If your Fields name no Kind, the plain hook is enough: `export { handleError } from '@svelte-admin/core/hooks';`. Once a Field names one, use `adminHooks(admin)`, as the demo does. See [Converting a Field's value](../README.md#converting-a-fields-value) in the README.

## 6. The admin layout

The admin layout renders the Theme's `AdminShell` with the admin from `admin.ts`: the sidebar of Resources and the breadcrumb, around each View. Two snippets are yours, so the admin looks like part of your app:

- `brand`, at the top of the sidebar. The shell wraps it in a link to the first Resource.
- `userMenu`, at the bottom. The demo has no sign-in, so it shows a fixed demo user in a `<details>` menu, which opens without JavaScript too. Put your own user and sign-out here.

<!-- demo: src/routes/admin/+layout.svelte -->

```svelte
<script lang="ts">
	import PanelsTopLeftIcon from '@lucide/svelte/icons/panels-top-left';
	import { AdminShell } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';

	let { children } = $props();

	// The demo has no sign-in, so its user menu shows a fixed demo user.
	const user = { name: 'Ada Lovelace', email: 'ada@example.com' };
	const initials = user.name
		.split(' ')
		.map((word) => word[0])
		.join('');
</script>

<AdminShell {admin}>
	{#snippet brand()}
		<span
			class="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
		>
			<PanelsTopLeftIcon class="size-4" />
		</span>
		Svelte Admin Demo
	{/snippet}

	{#snippet userMenu()}
		<!-- A <details> menu, so it opens without JavaScript too. -->
		<details class="group relative">
			<summary
				class="flex cursor-pointer list-none items-center gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent [&::-webkit-details-marker]:hidden"
			>
				<span
					aria-hidden="true"
					class="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent font-medium"
				>
					{initials}
				</span>
				<span class="grid flex-1 leading-tight">
					<span class="truncate font-medium">{user.name}</span>
					<span class="truncate text-xs text-muted-foreground">{user.email}</span>
				</span>
			</summary>
			<div
				class="absolute inset-x-0 bottom-full mb-1 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
			>
				<p class="px-2 py-1.5 text-xs text-muted-foreground">The demo has no sign-in.</p>
				<button type="button" disabled class="w-full rounded-sm px-2 py-1.5 text-start opacity-50">
					Sign out
				</button>
			</div>
		</details>
	{/snippet}

	{@render children()}
</AdminShell>
```

## 7. The admin index

The base path itself opens the first Resource's list, so `/admin` never shows a blank page. `admin.homeHref` is that list, or `undefined` when no Resource is mounted.

<!-- demo: src/routes/admin/+page.ts -->

```ts
import { error, redirect } from '@sveltejs/kit';
import { admin } from '#lib/admin.ts';

// The admin's index opens the first Resource's list.
export function load() {
	if (admin.homeHref === undefined) error(404, 'Not found');
	redirect(307, admin.homeHref);
}
```

## 8. The View routes

Four routes render the stock Views: the list, the detail, the create and the edit View. They all live under `src/routes/admin/[resource=resource]`, and they all read the same way:

- `admin.entry(params.resource)` resolves to the Resource and its remote module together, once the module has loaded. Await it in `$derived`, so a move to another Resource never pairs the new Resource with the old one's remote functions.
- The route passes the View the admin, the Resource and its remote functions. The admin is always an argument, never context: it is how a View reaches the admin's other Resources, such as a Reference's target.

Copy one and you have the other three.

### The list View

<!-- demo: src/routes/admin/[resource=resource]/+page.svelte -->

```svelte
<script lang="ts">
	import { ListView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<ListView {admin} {resource} {remote} />
```

### The id layout

The detail and edit Views sit under an `[id]` segment, and its layout turns the param into the Resource's typed id with `idFromParam`. A param that names no id, such as `abc` for a number id, is a 404 here, so it never reaches the Provider. It is the app's own policy, so it lives in the app.

<!-- demo: src/routes/admin/[resource=resource]/[id]/+layout.ts -->

```ts
import { error } from '@sveltejs/kit';
import { idFromParam } from '@svelte-admin/core';
import { admin } from '#lib/admin.ts';
import type { LayoutLoad } from './$types';

// The id param becomes the Resource's typed id, for the detail View and the edit View under it.
// A param that names none (`abc` for a number id) is a 404 here, so it never reaches the Provider.
export const load: LayoutLoad = ({ params }) => {
	const id = idFromParam(admin.resources[params.resource].resource, params.id);
	if (id === undefined) error(404, 'Not found');
	return { id };
};
```

### The detail View

It takes the typed id from the id layout's `data`.

<!-- demo: src/routes/admin/[resource=resource]/[id]/+page.svelte -->

```svelte
<script lang="ts">
	import { DetailView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params, data }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<DetailView {admin} {resource} {remote} id={data.id} />
```

### The edit View

<!-- demo: src/routes/admin/[resource=resource]/[id]/edit/+page.svelte -->

```svelte
<script lang="ts">
	import { EditView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params, data }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<EditView {admin} {resource} {remote} id={data.id} />
```

### The create View

It lives at `new`, beside `[id]`. SvelteKit ranks the static segment first, so `new` is never read as an id.

<!-- demo: src/routes/admin/[resource=resource]/new/+page.svelte -->

```svelte
<script lang="ts">
	import { CreateView } from '@svelte-admin/theme-shadcn';
	import { admin } from '#lib/admin.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const { resource, remote } = $derived(await admin.entry(params.resource));
</script>

<CreateView {admin} {resource} {remote} />
```

## 9. The error page

The Theme's `ErrorPage` shows a 404 or a failed load in the admin's style, with a link back to the admin. The demo's is the app's root error page, so it covers every path, a name the matcher turns away (`/admin/nope`) too.

<!-- demo: src/routes/+error.svelte -->

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ErrorPage } from '@svelte-admin/theme-shadcn';
</script>

<ErrorPage
	status={page.status}
	message={page.error?.message}
	path={page.url.pathname}
	homeHref={resolve('/admin')}
/>
```

## 10. Adding a Resource

The admin above mounts three Resources. Each one more takes three steps:

1. **A shared module**, `src/lib/resources/users.ts`: the Resource's schema and settings, from `defineResource`.
2. **A remote module**, `src/lib/resources/users.remote.ts`: one statement that serves the Resource's records through its Provider.
3. **An entry in `admin.ts`**: the shared module's import, and `users: { resource: users, remote: () => import('#lib/resources/users.remote.ts') }` under `resources` (see [`admin.ts`](#3-admints)). The key is the Resource's `name`, or `defineAdmin` throws.

The sidebar, the param matcher, the four View routes and the error page pick the new Resource up from `admin.ts`, so no route changes.

### Two modules, kept apart

The shared module and the remote module are separate on purpose, because they run in different places:

- **The shared module is browser-safe.** `admin.ts` imports it, and every View, the sidebar and `params.ts` read `admin.ts`, so it reaches the browser. It holds only metadata: the schema, the labels, what sorts and filters. Like `admin.ts`, it must load in plain Node (see [`params.ts`](#4-paramsts)), which is why the icon is a lazy import.
- **The remote module is server-only.** SvelteKit runs a `.remote.ts` file's functions on the server and gives the browser only calls to them, so the remote module, and the Provider it imports, never reach the browser. A Provider's backend URL and credentials belong on this side. `admin.ts` imports the remote module lazily, so `admin.ts` itself stays browser-safe.

Never import a Provider, `@svelte-admin/core/server` or `@svelte-admin/core/rest` from the shared module or from `admin.ts`.

### The shared module

The demo's users are a short example. Each Field is a Zod type, wrapped in `field()` when it has settings:

<!-- demo: src/lib/resources/users.ts -->

```ts
import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';

export const users = defineResource({
	name: 'users',
	label: 'Users',
	icon: () => import('@lucide/svelte/icons/users'),
	group: 'People',
	// The demo backend searches users by name and email.
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true }),
		// Set once on create, then shown as text on the edit View.
		email: field(z.email(), { readOnly: 'afterCreate', placeholder: 'name@example.com' }),
		// Optional, so clearing it on the edit View removes it.
		phone: z.string().optional(),
		role: field(z.enum(['admin', 'editor', 'viewer']), { filterable: true }),
		active: field(z.boolean(), { filterable: true }),
		joinedAt: field(z.iso.datetime(), { sortable: true, filterable: true })
	}),
	// The list opens in name order, with nothing in the URL.
	defaultSort: { field: 'name', order: 'asc' }
});
```

Each setting has its section in the README's reference:

- `searchable`, `sortable`, `filterable`, `defaultSort` and `perPage`: [Sorting](../README.md#sorting), [Filtering](../README.md#filtering) and [Default sort and page size](../README.md#default-sort-and-page-size).
- `readOnly`, `hidden` and `input`: [Writes](../README.md#writes) and [Typed form fields](../README.md#typed-form-fields-and-a-replaced-form-view).
- `kind`: [Kinds](../README.md#kinds).
- `ref`: [References](../README.md#references).
- `group` and `icon` place the Resource in the sidebar. The icon is a lazy import of a Lucide icon, and the sidebar groups Resources by `group` in the order `admin.ts` lists them.

### The remote module

One statement: `serveResource` from `@svelte-admin/core/server` takes the Resource and its Provider, and returns the Resource's eight remote functions. SvelteKit requires each remote function to be a named export of a `.remote.ts` file, so the module re-exports all eight by name:

<!-- demo: src/lib/resources/users.remote.ts -->

```ts
import { serveResource } from '@svelte-admin/core/server';
import { backend } from '#lib/server/backend.ts';
import { users } from './users.ts';

export const { getList, getOne, lookup, create, update, deleteOne, deleteMany, exportList } =
	serveResource(users, backend.for(users));
```

Copy the statement as it is, and change only the Resource and the Provider. `admin.ts` requires all eight, so a remote module that leaves one out is a type error in its `admin.ts` entry, not a broken Reference (a missing `lookup`) or a failed export (a missing `exportList`) at runtime.

### The Provider

The Provider is how the Resource reaches your backend. There are two choices.

**The bundled REST Provider**, for a backend that follows its REST convention. `restProvider(baseUrl)` from `@svelte-admin/core/rest` is shared by every Resource, and `backend.for(users)` is the Provider for one, typed from it, as in `users.remote.ts` above. The demo creates it once, in a server-only module:

<!-- demo: src/lib/server/backend.ts -->

```ts
// The demo backend, through the bundled REST Provider. Server-only: nothing here may reach the
// browser (CI checks the client build for the backend URL).
import { restProvider } from '@svelte-admin/core/rest';
import { BACKEND_URL } from '../../../backend/config.ts';

export const backend = restProvider(BACKEND_URL);
```

The demo reads its backend's URL from the demo backend's config. Your app reads its own, from its environment for one. The requests it sends are in the README: the list's in [Sorting](../README.md#sorting) and [Filtering](../README.md#filtering), the writes' in [Writes](../README.md#writes), and the batched lookups' in [References](../README.md#references).

**Your own Provider**, an object with the methods `getList`, `getOne`, `create`, `update` and `deleteOne`, plus the optional `getMany` and `deleteMany`, each typed from the Resource with `ResourceProvider<typeof resource>`. It can start from the REST Provider's methods and change only what differs, as the demo's posts Provider does: it spreads `backend.for(posts)`, leaves out `getMany`, and adds a `deleteMany` over the backend's bulk route.

<!-- demo: src/lib/server/posts-provider.ts -->

```ts
// The posts Provider: the bundled REST Provider's methods (so its `getList` forwards the page, the
// page size, the sort and the filters), but not its `getMany`, plus `deleteMany` over the demo
// backend's bulk route, which the REST convention doesn't have. It shows how an app spreads the
// bundled Provider for one Resource, adding a method and leaving one out. Recipes and users have
// no bulk route, so their bulk deletes fall back to one `deleteOne` per id. Without `getMany`, the
// posts that a page's posts reply to are looked up with one `getOne` each, so the demo covers
// that fallback. Server-only, like `backend.ts`.
import { NotFoundError, type ResourceProvider } from '@svelte-admin/core';
import { BACKEND_URL } from '../../../backend/config.ts';
import { posts } from '#lib/resources/posts.ts';
import { backend } from './backend.ts';

/** The Provider for posts: the bundled REST Provider's methods but `getMany`, plus `deleteMany`. */
export const postsProvider: ResourceProvider<typeof posts> = {
	...backend.for(posts),
	// Left out, so the admin looks posts up with `getOne`, one request per id.
	getMany: undefined,
	/** `DELETE /posts?id=1&id=2`: all of them, or none (a 404 when any doesn't exist). */
	async deleteMany({ fetch }, ids) {
		const query = new URLSearchParams(ids.map((id) => ['id', String(id)]));
		const response = await fetch(`${BACKEND_URL}/posts?${query}`, { method: 'DELETE' });
		// Nothing is read from the response, so free its body.
		await response.body?.cancel();
		if (response.status === 404) throw new NotFoundError();
		if (!response.ok) {
			throw new Error(`Posts Provider: DELETE /posts failed with ${response.status}`);
		}
	}
};
```

The posts remote module passes it to `serveResource` in place of `backend.for(posts)`, with an option that caps the export:

<!-- demo: src/lib/resources/posts.remote.ts -->

```ts
import { serveResource } from '@svelte-admin/core/server';
import { postsProvider } from '#lib/server/posts-provider.ts';
import { posts } from './posts.ts';

// Exports stop at 50 posts, so with the 60 seeded ones the e2e suite covers the cap, and the
// export pages through a backend that answers with `hasNextPage` instead of a total.
export const { getList, getOne, lookup, create, update, deleteOne, deleteMany, exportList } =
	serveResource(posts, postsProvider, { maxExportRows: 50 });
```

What each method gets and returns is in the README: [Writes](../README.md#writes) for `create`, `update`, `deleteOne` and `deleteMany`, and [References](../README.md#references) for `getMany`.

## Mounting at `/`

When the admin is the whole app, such as an internal tool, mount it at `/`, so no URL needs `/admin`. Only three things change from the files above.

**The base path.** In `admin.ts`, write `basePath: '/'`. The list hrefs become `/users`, the detail hrefs `/users/3`, and the create and edit hrefs follow, as do the sidebar, the breadcrumb and `homeHref`.

**The route files, one level up.** Move `src/routes/admin` to `src/routes/(admin)`, unchanged. A folder in parentheses is a SvelteKit route group: it adds nothing to the URL, so the View routes now answer at `/users` and `/users/3/edit`, and the admin layout still wraps only the admin's routes, not the rest of your app.

```text
src/routes/
├── +error.svelte
├── +layout.svelte
└── (admin)/
    ├── +layout.svelte          the admin layout
    ├── +page.ts                the admin index, now at /
    └── [resource=resource]/
        ├── +page.svelte
        ├── new/+page.svelte
        └── [id]/
            ├── +layout.ts
            ├── +page.svelte
            └── edit/+page.svelte
```

**The admin index at the root.** `(admin)/+page.ts` now answers `/` and opens the first Resource's list, so your app has no other root page. The error page's link back to the admin becomes `homeHref={resolve('/')}`.

Your other routes keep working beside the admin's. SvelteKit ranks a route with a static segment, such as `src/routes/about`, above the admin's `[resource=resource]` route, and the matcher accepts only the names `admin.ts` mounts, so `/about` stays yours and `/nope` is a 404. A route of yours named after a Resource wins over the admin's too: that is how a View is replaced, below.

## Replacing a View

When a stock View doesn't fit one Resource, replace that one View with a route of your own at its path. A route at the View's own path wins over the admin's, since its segment is static: `src/routes/admin/users/+page.svelte` replaces the users list View, and `src/routes/admin/posts/new/+page.svelte` the posts create View (under `src/routes/(admin)` when mounted at `/`). The admin's other Views of that Resource, and every View of the others, stay stock.

A replaced View takes the same admin, Resource and remote module as the stock View's route. It names its Resource, so it imports them directly instead of calling `admin.entry`: the admin from `admin.ts`, the Resource from its shared module and the remote functions as `* as remote` from its remote module. It builds on the core's headless helpers from `@svelte-admin/core/views`, such as `createListView(admin, users, remote)` or `createFormView(admin, posts, remote, 'create')`, which keep the stock View's behaviour, and on the Theme's exported parts, which keep its look. It sits under the admin layout, so the shell wraps it as it wraps the stock Views.

The demo has two, as examples:

- **The users list View**, `src/routes/admin/users/+page.svelte`: the users as a card grid, with the stock search, filters, paging and selection.
- **The posts create View**, `src/routes/admin/posts/new/+page.svelte`: a two-column form, with typed inputs and the author chosen with the Theme's `ReferencePicker`.

What a replaced View can read from the helpers is in the README: [Typed form fields and a replaced form View](../README.md#typed-form-fields-and-a-replaced-form-view) for the forms, the replaced list View's sort, filters and export under [Sorting](../README.md#sorting), [Filtering](../README.md#filtering) and [Export](../README.md#export), and a Reference under [References](../README.md#references) and [The Reference picker](../README.md#the-reference-picker).

## In production

SvelteKit refuses a form post whose origin isn't the app's own, and `adapter-node` can't always tell the app's origin from the request, behind a proxy above all. So set `ORIGIN` to the URL people reach the app at when you run the build, such as `ORIGIN=https://admin.example.com node build`, or the create and edit forms may be refused. The demo's e2e suite sets `http://localhost:4173`.

## Files only the demo needs

A few files in the demo aren't part of the setup, so this guide doesn't quote them. Don't copy them into your app:

- **The root layout**, `src/routes/+layout.svelte`. Beside importing the stylesheet, it marks the page once it is hydrated, for the e2e tests.
- **The root redirect**, `src/routes/+page.ts`. It sends `/` to `/admin`, because the demo is only an admin. Your app has its own home page.
- **The demo backend**, `apps/demo/backend`. It is a small Bun server that serves seed data from memory. Your Resources talk to your own backend.

## Before npm

`@svelte-admin/core` and `@svelte-admin/theme-shadcn` are private, at version `0.0.0`, and aren't published to npm. They stay that way until remote functions and async Svelte are stable, so no one depends on an API that may still move. See [ADR 0001](adr/0001-rebuild-the-proof-of-concept-as-a-workspace.md).

Until then, an app is a member of this bun workspace, as the demo is: it lives under `apps/`, and its `package.json` depends on `"@svelte-admin/core": "workspace:*"` and `"@svelte-admin/theme-shadcn": "workspace:*"`, and on the rest through `catalog:`, so it gets the versions the workspace pins.

An app outside the workspace isn't supported yet. The packages declare `workspace:*` and `catalog:` versions, which mean nothing outside it, and they export their TypeScript and Svelte sources, which an app's build would have to compile from `node_modules`.
