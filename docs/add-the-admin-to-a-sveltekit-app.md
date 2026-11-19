# Add the admin to a SvelteKit app

This guide takes an existing SvelteKit app to a working admin, one file at a time, in the order you write them. It mounts the admin under `/admin`, as the demo app does.

Every file below is quoted whole from the demo (`apps/demo`), under its path there, never as an excerpt. The demo's files are the source of truth: CI runs `bun run check:docs`, which fails when a quote here differs from the file the demo runs, so what you copy is what works. The terms (Resource, View, Kind, Theme, Provider) are the ones in [`CONTEXT.md`](../CONTEXT.md).

## Before you start

The admin is built on features that are still experimental: remote functions in SvelteKit and async Svelte. It needs the exact versions this workspace pins in the `catalog` of the root `package.json`: SvelteKit 3.2, Svelte 5.57, Vite 8, Tailwind CSS 4 and Zod 4, on Node 22.

The packages aren't published. `@svelte-admin/core` and `@svelte-admin/theme-shadcn` are private, and an app uses them as a member of this bun workspace, as the demo does, with `"@svelte-admin/core": "workspace:*"` and `"@svelte-admin/theme-shadcn": "workspace:*"` in its dependencies. See [ADR 0001](adr/0001-rebuild-the-proof-of-concept-as-a-workspace.md) for why.

Beside them, the demo depends on `zod` and `@lucide/svelte` (for its icons), and on `@sveltejs/adapter-node`, `@tailwindcss/vite` and `tailwindcss` for its build. See `apps/demo/package.json` for the full list.

The demo's modules import each other as `#lib/admin.ts`, not `$lib/admin`. Its `package.json` maps `"imports": { "#lib/*": "./src/lib/*" }`, a Node subpath import. That matters for `params.ts` below: SvelteKit loads it in plain Node, where Kit's `$lib` alias doesn't exist.

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

The base path starts with `/` and doesn't end with one, or `defineAdmin` throws at startup. Keep it in step with the folder the admin's routes live in: `/admin` here, so the routes below sit in `src/routes/admin`.

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

Every import in `admin.ts` stays loadable in plain Node: the remote modules, the Kinds' components and the Resources' icons are lazy imports (`() => import(...)`), and the modules it imports eagerly use `#lib`, never `$lib` or `$app`. `params.ts` is why.

The Resource modules themselves (`recipes.ts` and `recipes.remote.ts`, for one) are covered in [Wiring a Resource](../README.md#wiring-a-resource) in the README.

## 4. `params.ts`

Each View route has a `[resource=resource]` segment, and `params.ts` defines its matcher: `admin.matchResource` accepts only the names `admin.ts` mounts, so any other name is a 404 before a route loads, and a route of your own beside the admin's keeps working.

<!-- demo: src/params.ts -->

```ts
import { defineParams } from '@sveltejs/kit/params';
import { admin } from '#lib/admin.ts';

export const params = defineParams({ resource: admin.matchResource });
```

SvelteKit loads `params.ts` in plain Node at build time, with a plain `import()`, outside Vite. So `admin.ts`, and every module it imports eagerly, must load there too: no `$lib` or `$app` imports, which only Vite resolves, and no `.svelte` file, which Node can't load. That is why `admin.ts` imports with `#lib` and lazily imports anything that is a component or server-only.

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

The admin layout renders the Theme's `AdminShell` with the admin from `admin.ts`: the sidebar of Resources, the breadcrumb and the page around each View. Two snippets are yours, so the admin looks like part of your app:

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

## In production

SvelteKit refuses a form post whose origin isn't the app's own, and `adapter-node` can't always tell the app's origin from the request, behind a proxy above all. So set `ORIGIN` to the URL people reach the app at when you run the build, such as `ORIGIN=https://admin.example.com node build`, or the create and edit forms may be refused. The demo's e2e suite sets `http://localhost:4173`.

## Files only the demo needs

A few files in the demo aren't part of the setup, so this guide doesn't quote them. Don't copy them into your app:

- **The root layout**, `src/routes/+layout.svelte`. Beside importing the stylesheet, it marks the page once it is hydrated, for the e2e tests.
- **The root redirect**, `src/routes/+page.ts`. It sends `/` to `/admin`, because the demo is only an admin. Your app has its own home page.
- **The demo backend**, `apps/demo/backend`. It is a small Bun server that serves seed data from memory. Your Resources talk to your own backend.
