import type { RecordOf, Resource } from './resource.ts';
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

/** Each key must be its Resource's name, so a URL segment and a Resource never disagree. */
type AdminResources<M> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema fits
	[K in keyof M]: AdminEntry<Resource<K & string, any>>;
};

/**
 * The app's admin: its base path and its Resources by name. Write it once in `admin.ts`; the
 * routes, the param matcher and (later) the sidebar all read the same list. It imports only
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

	return {
		basePath,
		resources,
		/**
		 * The param matcher for a Resource segment: the name if it is one of this admin's
		 * Resources, otherwise `undefined`. `Object.hasOwn` keeps inherited keys such as
		 * `toString` from matching. Use it in `src/params.ts`:
		 *
		 * @example
		 * export const params = defineParams({ resource: admin.matchResource });
		 */
		matchResource(param: string): Name | undefined {
			return Object.hasOwn(resources, param) ? (param as Name) : undefined;
		}
	};
}

/** The admin `defineAdmin` returns. */
export type Admin = ReturnType<typeof defineAdmin>;

/** The names of an admin's Resources, e.g. `'recipes' | 'users'`. */
export type ResourceNameOf<A extends { resources: object }> = keyof A['resources'] & string;
