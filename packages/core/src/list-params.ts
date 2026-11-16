import { z } from 'zod';
import type { Field } from './fields.ts';
import type { ListParams, ListParamsResource, ListSort, SortOrder } from './provider.ts';
import type { Resource } from './resource.ts';

/** The largest page size `getList` accepts. */
export const MAX_PER_PAGE = 100;

/** The page size a list View uses when the URL doesn't name one. */
export const DEFAULT_PER_PAGE = 25;

const pageParams = z.strictObject({
	page: z.int().min(1),
	perPage: z.int().min(1).max(MAX_PER_PAGE)
});

/**
 * A list View leaves a blank search out, so `getList` never receives one. The URL keeps the
 * search as typed, and the Provider gets it without the spaces around it.
 */
const searchableListParams = pageParams.extend({ search: z.string().trim().min(1).optional() });

/** The directions a sort can take, as `getList` and the list URL name them. */
const sortOrder = z.enum(['asc', 'desc']) satisfies z.ZodType<SortOrder>;

/** What `listParamsSchema` asks of a Resource: what `ListParams` does, and its described Fields. */
export type ListSchemaResource = ListParamsResource & Pick<Resource, 'fields'>;

/**
 * Check a Resource's list settings at startup: a `defaultSort` on a sortable Field, ascending or
 * descending, and a `perPage` from 1 to `MAX_PER_PAGE`. TypeScript catches most of these, but
 * not a Resource whose Fields it can't see, nor a page size out of range.
 */
export function assertListSettings(
	name: string,
	fields: readonly Field[],
	{ defaultSort, perPage }: { defaultSort?: ListSort; perPage: number }
): void {
	if (defaultSort !== undefined) {
		const { field, order } = defaultSort;
		if (!sortableKeys({ fields }).includes(field)) {
			throw new Error(
				`Resource "${name}": its \`defaultSort\` names the Field "${field}", which is not sortable. ` +
					'Mark the Field `sortable: true` with `field()`, or sort by another one.'
			);
		}
		if (!sortOrder.safeParse(order).success) {
			throw new Error(
				`Resource "${name}": its \`defaultSort\` order must be "asc" or "desc", not ${JSON.stringify(order)}.`
			);
		}
	}
	if (!pageParams.shape.perPage.safeParse(perPage).success) {
		throw new Error(
			`Resource "${name}": its \`perPage\` must be a whole number from 1 to ${MAX_PER_PAGE}, not ${perPage}.`
		);
	}
}

/**
 * The params `getList` hands its Provider: those it was given, with the Resource's
 * `defaultSort` when they name no sort, so every caller gets the same order.
 */
export function withDefaultSort<P extends ListParams>(
	params: P,
	resource: Pick<Resource, 'defaultSort'>
): P {
	const { defaultSort } = resource;
	return params.sort !== undefined || defaultSort === undefined
		? params
		: { ...params, sort: { ...defaultSort } };
}

/** The keys of a Resource's sortable Fields, in schema order. */
export function sortableKeys(resource: Pick<Resource, 'fields'>): string[] {
	return resource.fields.filter((field) => field.sortable).map((field) => field.key);
}

/**
 * The input schema of a Resource's `getList` query: a page and a page size, plus a search only
 * when the Resource is searchable, and a sort only when it has a sortable Field, on one of those
 * Fields. It is strict: an undeclared key (a search included, for a Resource that isn't
 * searchable, and a sort for one with no sortable Field) or a sort on any other Field is invalid
 * input, so a Provider never sees one, and nothing is coerced. Its input and output are the
 * Resource's `ListParams`, so the remote `getList` built from it is typed from the Resource.
 */
export function listParamsSchema<R extends ListSchemaResource>(
	resource: R
): z.ZodType<ListParams<R>, ListParams<R>> {
	// The runtime check matches the type: a search only when the Resource is searchable, and a
	// sort only on a sortable Field.
	const base = resource.searchable ? searchableListParams : pageParams;
	const [first, ...rest] = sortableKeys(resource);
	const schema =
		first === undefined
			? base
			: base.extend({
					sort: z.strictObject({ field: z.enum([first, ...rest]), order: sortOrder }).optional()
				});
	return schema as unknown as z.ZodType<ListParams<R>, ListParams<R>>;
}

/** The schemas of the page and the page size, for reading them from a URL. */
export const pageParamSchemas = pageParams.shape;
