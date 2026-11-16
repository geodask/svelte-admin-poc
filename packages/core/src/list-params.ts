import { z } from 'zod';
import type { ListParams, ListParamsResource } from './provider.ts';
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
const sortOrder = z.enum(['asc', 'desc']);

/** What `listParamsSchema` asks of a Resource: what `ListParams` does, and its described Fields. */
export type ListSchemaResource = ListParamsResource & Pick<Resource, 'fields'>;

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
