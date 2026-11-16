import { z } from 'zod';
import { pageParamSchemas, sortableKeys, type ListSchemaResource } from './list-params.ts';
import type { ListParams, ListSort, SortOrder } from './provider.ts';
import type { Resource } from './resource.ts';

/**
 * A URL param of plain digits that must also pass `schema`, or `fallback` when it is missing
 * or bad. Only digits, so `2e1`, `0x2` and ` 2` are bad rather than read as numbers.
 */
function urlInt(schema: z.ZodInt, fallback: number) {
	return z.string().regex(/^\d+$/).transform(Number).pipe(schema).catch(fallback);
}

/**
 * Values a list param is left out of the encoding at, when they are given: the page, the page
 * size, the order of a sort on any Field, and a whole sort (a Field and its order).
 */
export type ListParamDefaults = {
	page: number;
	perPage: number;
	order: SortOrder;
	sort?: ListSort;
};

/** What the list URL asks of a Resource: what `listParamsSchema` does, and its list settings. */
export type ListUrlResource = ListSchemaResource & ListSettings;

/** A Resource's list settings, which `listHref` leaves out of a URL: its page size and default sort. */
export type ListSettings = Pick<Resource, 'perPage' | 'defaultSort'>;

/**
 * The defaults a Resource's list URL falls back to when it leaves a param out, and so leaves
 * out: page 1, the Resource's page size and its default sort, and an ascending order.
 */
function urlDefaults(resource: ListSettings): ListParamDefaults {
	const { perPage, defaultSort } = resource;
	return { page: 1, perPage, order: 'asc', sort: defaultSort };
}

/** Whether two sorts are the same, or both absent. */
function sameSort(a: ListSort | undefined, b: ListSort | undefined): boolean {
	return a?.field === b?.field && a?.order === b?.order;
}

/**
 * A search worth sending, or `undefined`. A blank one is no search. A real one is kept as
 * typed, spaces included, so a search box that writes the URL never has its text rewritten.
 */
function nonBlank(value: string | null | undefined): string | undefined {
	return value?.trim() ? value : undefined;
}

/**
 * The sort a list View's URL names, or `undefined`: `sort` names a sortable Field (any other, or
 * none, is no sort), ascending unless `order` is `desc`. An `order` without a `sort` means
 * nothing.
 */
function readSort(
	searchParams: URLSearchParams,
	resource: Pick<ListSchemaResource, 'fields'>
): ListSort | undefined {
	const field = searchParams.get('sort');
	if (field === null || !sortableKeys(resource).includes(field)) return undefined;
	return { field, order: searchParams.get('order') === 'desc' ? 'desc' : 'asc' };
}

/**
 * The list params a list View's URL names, with defaults for what it leaves out: page 1, the
 * Resource's page size, and its default sort if it has one. The search is read from `q`, and
 * only for a searchable Resource. The sort is read from `sort` and `order`, and only on a
 * sortable Field.
 */
export function readListParams<R extends ListUrlResource>(url: URL, resource: R): ListParams<R> {
	const { searchParams } = url;
	const defaults = urlDefaults(resource);
	const params: ListParams = z
		.object({
			page: urlInt(pageParamSchemas.page, defaults.page),
			perPage: urlInt(pageParamSchemas.perPage, defaults.perPage)
		})
		.parse({
			page: searchParams.get('page') ?? undefined,
			perPage: searchParams.get('perPage') ?? undefined
		});
	const search = resource.searchable ? nonBlank(searchParams.get('q')) : undefined;
	if (search !== undefined) params.search = search;
	const sort = readSort(searchParams, resource) ?? defaults.sort;
	if (sort !== undefined) params.sort = { ...sort };
	// A search only for a searchable Resource, and a sort only on a sortable Field, as its type says.
	return params as ListParams<R>;
}

/**
 * The one encoding of list params as search params, shared by the list URL and the bundled REST
 * Provider so the two can't drift: `page`, `perPage`, the sort as `sort` and `order`, then the
 * search as `q`. A blank search is never written, nor an `order` without a sort. Given
 * `defaults`, a param at its default is left out too, as the list URL does (so `order=asc` is
 * never in it, nor the default sort); without them every other param is written, as the REST
 * Provider does, so a backend never has to know the defaults. `readListParams` reads it back.
 */
export function encodeListParams(
	params: ListParams,
	defaults?: ListParamDefaults
): URLSearchParams {
	const encoded = new URLSearchParams();
	if (params.page !== defaults?.page) encoded.set('page', String(params.page));
	if (params.perPage !== defaults?.perPage) encoded.set('perPage', String(params.perPage));
	if (params.sort !== undefined && !sameSort(params.sort, defaults?.sort)) {
		encoded.set('sort', params.sort.field);
		if (params.sort.order !== defaults?.order) encoded.set('order', params.sort.order);
	}
	const q = nonBlank(params.search);
	if (q !== undefined) encoded.set('q', q);
	return encoded;
}

/**
 * The href of the list at `url`'s path with `params`, for pager, page-size and search links.
 * It keeps the path, so it carries the admin's base path and works the same in a replaced
 * View. Only params that differ from their defaults are written (the Resource's own page size
 * and default sort included, and a blank search is none), and every other search param is
 * dropped. Params with no sort read back with the Resource's default sort.
 */
export function listHref(url: URL, params: ListParams, resource: ListSettings): string {
	const query = encodeListParams(params, urlDefaults(resource)).toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * Where a list URL should be rewritten to, or `undefined` when it is already clean. A URL is
 * clean when it names only known params with good values that differ from their defaults (the
 * Resource's page size and default sort included); the order they are written in doesn't
 * matter. `q` is known only for a searchable Resource, and `sort` only on a sortable Field, with
 * `order` only beside it and only as `desc`. The rewrite keeps the path and the hash.
 */
export function listUrlRewrite(url: URL, resource: ListUrlResource): string | undefined {
	const clean = listHref(url, readListParams(url, resource), resource);
	const cleanParams = new URL(clean, url).searchParams;
	cleanParams.sort();
	const params = new URLSearchParams(url.searchParams);
	params.sort();
	return params.toString() === cleanParams.toString() ? undefined : clean + url.hash;
}
