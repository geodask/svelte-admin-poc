import type { Component } from 'svelte';
import type { z } from 'zod';
import { describeFields, type Field } from './fields.ts';

/** Any Zod object schema. `defineResource` checks that it has a usable `id` Field. */
export type ResourceSchema = z.ZodObject;

/**
 * A Resource's icon: a lazy import of an icon component, e.g. a Lucide icon written as
 * `() => import('@lucide/svelte/icons/chef-hat')`. It is lazy because SvelteKit loads
 * `src/params.ts`, which reads `admin.ts` and so every Resource module, in plain Node at build
 * time, where a `.svelte` file can't load. The Theme renders it with a `class`.
 */
export type ResourceIcon = () => Promise<{ default: Component<{ class?: string }> }>;

/**
 * A Resource: a named kind of record the admin manages. It holds metadata only, so the
 * module that defines it is safe to import in the browser. Its data operations are wired on
 * the server with `serveResource` from `@svelte-admin/core/server`.
 */
export type Resource<N extends string = string, S extends ResourceSchema = ResourceSchema> = {
	readonly name: N;
	readonly label: string;
	/** The icon the sidebar shows beside the label, if any. */
	readonly icon?: ResourceIcon;
	/** The sidebar group the Resource is listed under, e.g. "Content". None: listed ungrouped. */
	readonly group?: string;
	readonly schema: S;
	/** Whether the list View offers a search box and `getList` accepts a search. */
	readonly searchable: boolean;
	/** Its Fields in schema key order, with labels, Kinds and where each one shows. */
	readonly fields: readonly Field[];
};

/** The type of one record of a Resource. */
export type RecordOf<R extends Resource> = z.output<R['schema']>;

/**
 * The type of a Resource's ids: its `id` Field's type, a string or a number. (The intersection
 * only tells TypeScript so for a Resource it can't see yet; it changes no Resource's id type.)
 */
export type IdOf<R extends Resource> = RecordOf<R>['id'] & (string | number);

// The id schema must give a string or a number, and must take that same type as input, so a
// route param or a query argument can never be coerced into an id ('1' and 1 are not the same).
type IdField = z.ZodType<string, string> | z.ZodType<number, number>;

type HasValidId<S extends ResourceSchema> = 'id' extends keyof S['shape']
	? S['shape']['id'] extends IdField
		? true
		: false
	: false;

type IdRequired = {
	'A Resource schema needs an `id` Field of string or number type, with no coercion': true;
};

export function defineResource<const N extends string, S extends ResourceSchema>(definition: {
	/** The Resource's name, also its URL segment and its key in `admin.ts`. */
	name: N;
	/** The plural label shown in headings and the sidebar, e.g. "Recipes". */
	label: string;
	/**
	 * The sidebar icon: a lazy import of an icon component, such as
	 * `() => import('@lucide/svelte/icons/chef-hat')`.
	 */
	icon?: ResourceIcon;
	/**
	 * The sidebar group to list the Resource under. Groups appear in the order their first
	 * Resource appears in `admin.ts`; a Resource without one is listed in a group with no label.
	 */
	group?: string;
	/** One Zod object schema, the single source of truth for the Resource's Fields. */
	schema: S & (HasValidId<S> extends true ? unknown : IdRequired);
	/**
	 * Whether the backend can search this Resource. Only then does the list View show a search
	 * box, and only then does `getList` accept a search: for any other Resource it is rejected.
	 */
	searchable?: boolean;
}): Resource<N, S> {
	const { name, label, icon, group, schema, searchable = false } = definition;
	return { name, label, icon, group, schema, searchable, fields: describeFields(schema) };
}
