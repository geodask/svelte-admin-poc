import { CREATE_SEGMENT, EDIT_SEGMENT, decodeSegment, idFromParam, joinPath } from './ids.ts';
import { assertKindInputs } from './form-spec.ts';
import { assertAdminKinds, type AdminKinds } from './kinds.ts';
import type { IdOf, RecordOf, Resource, ResourceIcon } from './resource.ts';
import type { ResourceRemote } from './remote.ts';

/**
 * One Resource in `admin.ts`: the Resource, plus a dynamic import of its remote module.
 *
 * The import is lazy because SvelteKit loads `src/params.ts`, which reads `admin.ts`, in plain
 * Node at build time, where a remote module (and the `$app/server` it imports) can't load.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Resource fits by default
export type AdminEntry<R extends Resource = Resource<string, any>> = {
	resource: R;
	remote: () => Promise<ResourceRemote<RecordOf<R>>>;
};

/**
 * A Resource and its remote module, loaded: what `admin.entry(name)` resolves to. For a union of
 * names it is a union of pairs, one per Resource, so each Resource keeps its own remote functions.
 */
export type LoadedEntry<E extends AdminEntry = AdminEntry> = {
	resource: E['resource'];
	remote: Awaited<ReturnType<E['remote']>>;
};

/** What `entry` resolves to for the names `K`: one pair per Resource, never a mix of two. */
type LoadedEntryOf<M, K extends keyof M> = {
	[N in K]: M[N] extends AdminEntry ? LoadedEntry<M[N]> : never;
}[K];

/** One link in the sidebar: a Resource's list View. */
export type SidebarItem = {
	/** The Resource's name. */
	name: string;
	label: string;
	/** The href of the Resource's list View, under the admin's base path. */
	href: string;
	icon: ResourceIcon | undefined;
};

/** A sidebar group: its label (none for ungrouped Resources) and its links, in admin.ts order. */
export type SidebarGroup = { label: string | undefined; items: SidebarItem[] };

/** Each key must be its Resource's name, so a URL segment and a Resource never disagree. */
type AdminResources<M> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema fits
	[K in keyof M]: AdminEntry<Resource<K & string, any>>;
};

/**
 * The app's admin: its base path, its Resources by name, and its Kinds. Write it once in
 * `admin.ts`; the routes, the param matcher and the sidebar all read the same list. It imports
 * only shared and remote modules (and lazy imports of components), so it is safe in the browser.
 *
 * @example
 * export const admin = defineAdmin({
 * 	basePath: '/admin',
 * 	resources: {
 * 		recipes: { resource: recipes, remote: () => import('#lib/recipes.remote.ts') }
 * 	}
 * });
 * export type ResourceName = ResourceNameOf<typeof admin>;
 */
export function defineAdmin<const M extends AdminResources<M>>(config: {
	/**
	 * Where the admin is mounted: a prefix such as `/admin` or `/shop/admin`, which starts with `/`
	 * and doesn't end with one, or `/` when the admin is the whole app.
	 */
	basePath: string;
	resources: M;
	/**
	 * The app's Kinds, by name: each up to three lazy components (`input`, `cell`, `display`). A
	 * key is a named Kind from `Kinds`, which Fields name with `kind`, or a built-in Kind
	 * (`boolean`, `date`...), whose components it replaces for every Field of that Kind. Either
	 * replaces a Theme's Kind of the same name slot by slot, so a Kind that gives only a `cell`
	 * keeps the Theme's input and display. `object` and `reference` can't be replaced:
	 * `defineAdmin` throws.
	 *
	 * A named Kind may also convert the Field's value with `fromInput` and `toInput` (see
	 * `KindConversions`); a built-in Kind may not, as a type error, and `defineAdmin` throws. A
	 * Field whose type has no built-in input (a union, a record) is editable once it names an app
	 * Kind with an `input`: `defineAdmin` throws for one that names none, unless the Field is
	 * `readOnly: true` or hidden.
	 */
	kinds?: AdminKinds;
}) {
	const { basePath, resources } = config;
	// A copy, so the admin's Kinds can't change from outside.
	const kinds: AdminKinds = { ...config.kinds };

	// `/`, or segments that are each `/` and a non-empty name: never `//`, which a browser would
	// follow to another host.
	if (basePath !== '/' && !/^(\/[^/]+)+$/.test(basePath)) {
		throw new Error(
			`The admin base path must be "/", or start with "/" and not end with one, with no empty segment; got "${basePath}"`
		);
	}

	for (const [key, entry] of Object.entries<AdminEntry>(resources)) {
		if (entry.resource.name !== key) {
			throw new Error(
				`admin.ts lists the Resource "${entry.resource.name}" under "${key}"; use its name as the key`
			);
		}
	}
	assertTargetsMounted(resources);
	assertAdminKinds(kinds);
	for (const { resource } of Object.values<AdminEntry>(resources)) {
		assertKindInputs(resource, kinds);
	}

	type Name = keyof M & string;

	const listHref = (name: Name) => joinPath(basePath, name);
	// What every path in the admin starts with: `/admin/` under `/admin`, `/` at the root.
	const pathPrefix = joinPath(basePath, '');
	const isName = (segment: string): segment is Name => Object.hasOwn(resources, segment);
	const first = Object.keys(resources)[0] as Name | undefined;

	return {
		basePath,
		resources,
		/** The app's Kinds, by name, as `kinds` in admin.ts gave them (none: `{}`). */
		kinds,
		/**
		 * The sidebar: the Resources grouped by their group. Groups appear in the order their
		 * first Resource appears in admin.ts, and keep admin.ts order inside. Resources without a
		 * group share one group with no label, placed the same way.
		 */
		sidebar: sidebarGroups(Object.values<AdminEntry>(resources), (name) => listHref(name as Name)),
		/**
		 * The param matcher for a Resource segment: the name if it is one of this admin's
		 * Resources, otherwise `undefined`. `Object.hasOwn` keeps inherited keys such as
		 * `toString` from matching. Use it in `src/params.ts`:
		 *
		 * @example
		 * export const params = defineParams({ resource: admin.matchResource });
		 */
		matchResource(param: string): Name | undefined {
			return isName(param) ? param : undefined;
		},
		/** Where the admin's index leads: the first Resource's list in admin.ts, if there is one. */
		homeHref: first === undefined ? undefined : listHref(first),
		/**
		 * A Resource and its remote module, together in one promise, once the module has loaded.
		 * A View route reads both from it, so a switch to another Resource never pairs the new
		 * Resource with the old Resource's remote functions (and asks them for a list they don't
		 * take, such as another Resource's sort). It imports the module on every call; the
		 * bundler's module cache makes repeat calls cheap. A name that isn't mounted rejects: the
		 * param matcher has already turned one into a 404, so it is a programmer error.
		 *
		 * @example
		 * const { resource, remote } = $derived(await admin.entry(params.resource));
		 */
		async entry<K extends Name>(name: K): Promise<LoadedEntryOf<M, K>> {
			if (!isName(name)) {
				throw new Error(`The admin has no Resource named "${name}"; add it to admin.ts`);
			}
			const { resource, remote } = resources[name] as AdminEntry;
			return { resource, remote: await remote() } as LoadedEntryOf<M, K>;
		},
		/**
		 * The Resource a path is on, which of its Views, and on a detail or edit View the
		 * record's typed id, for the shell's active sidebar link and breadcrumb. The path is a URL
		 * pathname, still encoded. A path on a Resource's list or anything under it finds that
		 * Resource: the list itself is its list View, `{list}/new` its create View,
		 * `{list}/{id}/edit` an edit View, and any other next segment a detail View. The `id` is
		 * the `{id}` segment read as the Resource's id, or `undefined` when it names none. A path
		 * outside the admin's Resources finds nothing.
		 */
		locate(pathname: string): AdminLocation<M> | undefined {
			if (!pathname.startsWith(pathPrefix)) return undefined;
			const [name, param, action] = pathname.slice(pathPrefix.length).split('/');
			if (!isName(name)) return undefined;
			const entry = resources[name] as AdminEntry;
			const decoded = param === undefined ? undefined : decodeSegment(param);
			let view: AdminView = 'detail';
			if (param === undefined) view = 'list';
			else if (action === EDIT_SEGMENT) view = 'edit';
			else if (decoded === CREATE_SEGMENT) view = 'create';
			return {
				name,
				resource: entry.resource,
				remote: entry.remote,
				listHref: listHref(name),
				view,
				id: decoded === undefined ? undefined : idFromParam(entry.resource, decoded)
			} as AdminLocation<M>;
		}
	} satisfies Admin;
}

/**
 * Any admin `defineAdmin` returns: what the shell, the Views and their helpers take, so a View
 * can reach the admin's other Resources, not only its own. Each admin's own type keeps its
 * Resources' names and id types, and fits this one.
 */
export type Admin = {
	/** Where the admin is mounted, e.g. `/admin`, or `/` when it is the whole app. */
	readonly basePath: string;
	/** Its Resources by name, as admin.ts lists them. */
	readonly resources: Readonly<Record<string, AdminEntry>>;
	/** The app's Kinds, by name. */
	readonly kinds: AdminKinds;
	/** The sidebar: the Resources grouped by their group. */
	readonly sidebar: readonly SidebarGroup[];
	/** The param matcher for a Resource segment. */
	matchResource(param: string): string | undefined;
	/** Where the admin's index leads: the first Resource's list, if there is one. */
	readonly homeHref: string | undefined;
	/** A Resource and its remote module, together in one promise, once the module has loaded. */
	entry(name: string): Promise<LoadedEntry>;
	/** The Resource a path is on, which of its Views, and the record's typed id. */
	locate(pathname: string): AdminLocation<Record<string, AdminEntry>> | undefined;
};

/** Which of a Resource's Views a path is on. */
export type AdminView = 'list' | 'detail' | 'create' | 'edit';

/** Where a path is in the admin: see `locate`. One member per Resource, so `id` stays typed. */
export type AdminLocation<M> = {
	[K in keyof M & string]: M[K] extends AdminEntry<infer R>
		? {
				name: K;
				resource: R;
				/** The lazy import of the Resource's remote module, as in admin.ts. */
				remote: M[K]['remote'];
				listHref: string;
				view: AdminView;
				/** On a detail or edit View, the record's typed id, if the path names one. */
				id: IdOf<R> | undefined;
			}
		: never;
}[keyof M & string];

/**
 * Fails at startup when a Reference's target isn't mounted in admin.ts: no entry under the
 * target's name, or an entry that holds another Resource object. The Views reach a target
 * through its entry, so a Reference to a Resource that isn't there would link to nowhere.
 */
function assertTargetsMounted(resources: Readonly<Record<string, AdminEntry>>): void {
	for (const { resource } of Object.values(resources)) {
		for (const field of resource.fields) {
			if (field.kind !== 'reference') continue;
			// Every Resource module has loaded by now, so the target is defined.
			const target: Resource | undefined = field.ref();
			const name = target?.name;
			const mounted =
				name !== undefined && Object.hasOwn(resources, name) ? resources[name].resource : undefined;
			if (mounted === target) continue;
			const where = `Resource "${resource.name}": the Field "${field.key}" references "${name}"`;
			throw new Error(
				mounted === undefined
					? `${where}, which is not in admin.ts. Add it to the admin's \`resources\`.`
					: `${where}, but admin.ts lists another Resource under that name. Mount the one the Field references.`
			);
		}
	}
}

function sidebarGroups(entries: AdminEntry[], href: (name: string) => string): SidebarGroup[] {
	const groups = new Map<string | undefined, SidebarGroup>();
	for (const { resource } of entries) {
		const { name, label, icon, group } = resource;
		let target = groups.get(group);
		if (target === undefined) {
			target = { label: group, items: [] };
			groups.set(group, target);
		}
		target.items.push({ name, label, href: href(name), icon });
	}
	return [...groups.values()];
}

/** The names of an admin's Resources, e.g. `'recipes' | 'users'`. */
export type ResourceNameOf<A extends { resources: object }> = keyof A['resources'] & string;
