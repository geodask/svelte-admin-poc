import type { Component } from 'svelte';
import type { z } from 'zod';
import { assertFilterable, assertSortable, describeFields, type Field } from './fields.ts';
import { assertFormInputs } from './form-spec.ts';
import { assertListSettings, DEFAULT_PER_PAGE } from './list-params.ts';
import type { ListSort, SchemaSortableKey, UnusableFilterKey } from './provider.ts';
import { assertRecordTitle } from './record-title.ts';

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
 * The function form of the `recordTitle` setting. Declared as a method, whose parameter is
 * checked bivariantly, so a Resource with a narrower record type still counts as a `Resource`.
 */
type RecordTitleFunction<S extends ResourceSchema> = {
	bivariant(record: z.output<S>): string;
}['bivariant'];

/**
 * Which text names a record of a Resource, its Record title: the key of one of its Fields, or a
 * function of the record.
 */
export type RecordTitleSetting<S extends ResourceSchema = ResourceSchema> =
	(keyof S['shape'] & string) | RecordTitleFunction<S>;

/**
 * A Resource: a named kind of record the admin manages. It holds metadata only, so the
 * module that defines it is safe to import in the browser. Its data operations are wired on
 * the server with `serveResource` from `@svelte-admin/core/server`.
 */
export type Resource<
	N extends string = string,
	S extends ResourceSchema = ResourceSchema,
	Searchable extends boolean = boolean
> = {
	readonly name: N;
	readonly label: string;
	/** The icon the sidebar shows beside the label, if any. */
	readonly icon?: ResourceIcon;
	/** The sidebar group the Resource is listed under, e.g. "Content". None: listed ungrouped. */
	readonly group?: string;
	readonly schema: S;
	/**
	 * Whether the list View offers a search box and `getList` accepts a search. Kept in the type
	 * too, so a Resource's `ListParams` have a search only when it is searchable.
	 */
	readonly searchable: Searchable;
	/** Its Fields in schema key order, with labels, Kinds and where each one shows. */
	readonly fields: readonly Field[];
	/** Which text names a record, if the default rule isn't wanted: see `recordTitle()`. */
	// The key is kept as a plain string here: `keyof` the schema's shape would make `Resource`
	// invariant in its schema, so no Resource would count as a `Resource` any more.
	readonly recordTitle?: string | RecordTitleFunction<S>;
	/**
	 * The order the list View opens in, and the order `getList` gives the Provider when it is
	 * asked for no sort. None: the backend's order.
	 */
	// A plain string key, like `recordTitle`'s, for the same reason.
	readonly defaultSort?: ListSort;
	/** How many rows a page of the list View holds when its URL names no page size. */
	readonly perPage: number;
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

/** What a schema with a filterable Field the list URL can't hold is asked for: never met. */
type FilterKeyUsable<K extends string> = {
	[
		P in `The filterable Field "${K}" needs another key: page, perPage, sort, order, q and keys with a "." belong to the list URL`
	]: true;
};

export function defineResource<
	const N extends string,
	S extends ResourceSchema,
	const Searchable extends boolean = false
>(definition: {
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
	/**
	 * One Zod object schema, the single source of truth for the Resource's Fields. Every Field
	 * the forms edit needs a type they have an input for; one that has none (a union, a record)
	 * must be `readOnly: true` or `hidden`, or `defineResource` throws.
	 */
	schema: S &
		(HasValidId<S> extends true ? unknown : IdRequired) &
		([UnusableFilterKey<S>] extends [never] ? unknown : FilterKeyUsable<UnusableFilterKey<S>>);
	/**
	 * Whether the backend can search this Resource. Only then does the list View show a search
	 * box, and only then does `getList` accept a search: for any other Resource it is rejected.
	 */
	searchable?: Searchable;
	/**
	 * Which text names a record wherever the admin shows one (the detail View's heading, the
	 * breadcrumb, the row checkbox labels): the key of a Field, such as `'sku'`, or a function
	 * of the record, such as `(order) => \`Order #${order.number}\``. When it is a key, the list
	 * View links that Field's cell to the detail View. Without it, a record is named by its
	 * `name` Field, else its `title` Field, else its id. A key must name a Field that isn't
	 * hidden, or `defineResource` throws.
	 */
	recordTitle?: NoInfer<RecordTitleSetting<S>>;
	/**
	 * The order the list View opens in, such as `{ field: 'id', order: 'desc' }` for the newest
	 * first. `field` must be a sortable Field's key (hidden or not), or `defineResource` throws.
	 * It is never written to the list URL, and `getList` gives it to the Provider whenever it is
	 * asked for no sort. Without it, the list keeps the backend's order.
	 */
	defaultSort?: NoInfer<ListSort<SchemaSortableKey<S>>>;
	/**
	 * How many rows a page of the list View holds when its URL names no page size: 1 to
	 * `MAX_PER_PAGE` (100), or `defineResource` throws. Defaults to `DEFAULT_PER_PAGE` (25). It is
	 * never written to the list URL, and the list View offers it beside the stock page sizes.
	 */
	perPage?: number;
}): Resource<N, S, Searchable> {
	const { name, label, icon, group, schema, recordTitle, defaultSort } = definition;
	const perPage = definition.perPage ?? DEFAULT_PER_PAGE;
	// Left out, it is `false`, as the type parameter's default says.
	const searchable = (definition.searchable ?? false) as Searchable;
	const fields = describeFields(schema);
	// Fail at startup, not on a form that could never be saved.
	assertFormInputs(name, fields, schema);
	assertRecordTitle(name, fields, recordTitle);
	assertSortable(name, fields);
	assertFilterable(name, schema);
	assertListSettings(name, fields, { defaultSort, perPage });
	return {
		name,
		label,
		icon,
		group,
		schema,
		searchable,
		fields,
		recordTitle,
		// A copy, so the Resource's default can't change from outside.
		defaultSort: defaultSort && { field: defaultSort.field, order: defaultSort.order },
		perPage
	};
}
