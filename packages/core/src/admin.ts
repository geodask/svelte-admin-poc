import { CREATE_SEGMENT, EDIT_SEGMENT, decodeSegment, idFromParam } from './ids.ts';
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
 * The app's admin: its base path and its Resources by name. Write it once in `admin.ts`; the
 * routes, the param matcher and the sidebar all read the same list. It imports only
 * shared and remote modules, so it is safe in the browser.
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
	/** Where the admin is mounted, e.g. `/admin`. Starts with `/` and doesn't end with one. */
	basePath: string;
	resources: M;
}) {
	const { basePath, resources } = config;

	if (!/^\/.*[^/]$/.test(basePath)) {
		throw new Error(
			`The admin base path must start with "/" and not end with one, got "${basePath}"`
		);
	}

	for (const [key, entry] of Object.entries<AdminEntry>(resources)) {
		if (entry.resource.name !== key) {
			throw new Error(
				`admin.ts lists the Resource "${entry.resource.name}" under "${key}"; use its name as the key`
			);
		}
	}

	type Name = keyof M & string;

	const listHref = (name: Name) => `${basePath}/${name}`;
	const isName = (segment: string): segment is Name => Object.hasOwn(resources, segment);
	const first = Object.keys(resources)[0] as Name | undefined;

	return {
		basePath,
		resources,
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
		 * The Resource a path is on, which of its Views, and on a detail or edit View the
		 * record's typed id, for the shell's active sidebar link and breadcrumb. The path is a URL
		 * pathname, still encoded. A path on a Resource's list or anything under it finds that
		 * Resource: the list itself is its list View, `{list}/new` its create View,
		 * `{list}/{id}/edit` an edit View, and any other next segment a detail View. The `id` is
		 * the `{id}` segment read as the Resource's id, or `undefined` when it names none. A path
		 * outside the admin's Resources finds nothing.
		 */
		locate(pathname: string): AdminLocation<M> | undefined {
			if (!pathname.startsWith(`${basePath}/`)) return undefined;
			const [name, param, action] = pathname.slice(basePath.length + 1).split('/');
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
	};
}

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
