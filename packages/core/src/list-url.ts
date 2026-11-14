import { z } from 'zod';
import { DEFAULT_PER_PAGE, pageParamSchemas } from './list-params.ts';
import type { ListParams } from './provider.ts';
import type { Resource } from './resource.ts';

/**
 * A URL param of plain digits that must also pass `schema`, or `fallback` when it is missing
 * or bad. Only digits, so `2e1`, `0x2` and ` 2` are bad rather than read as numbers.
 */
function urlInt(schema: z.ZodInt, fallback: number) {
	return z.string().regex(/^\d+$/).transform(Number).pipe(schema).catch(fallback);
}

/** How a list View's URL search params map to list params. */
const listUrlSchema = z.object({
	page: urlInt(pageParamSchemas.page, 1),
	perPage: urlInt(pageParamSchemas.perPage, DEFAULT_PER_PAGE)
});

/**
 * A search worth sending, or `undefined`. A blank one is no search. A real one is kept as
 * typed, spaces included, so a search box that writes the URL never has its text rewritten.
 */
function searchOf(value: string | null | undefined): string | undefined {
	return value?.trim() ? value : undefined;
}

/**
 * The list params a list View's URL names, with defaults for what it leaves out. The search is
 * read from `q`, and only for a searchable Resource.
 */
export function readListParams(url: URL, resource: Pick<Resource, 'searchable'>): ListParams {
	const { searchParams } = url;
	const params: ListParams = listUrlSchema.parse({
		page: searchParams.get('page') ?? undefined,
		perPage: searchParams.get('perPage') ?? undefined
	});
	const search = resource.searchable ? searchOf(searchParams.get('q')) : undefined;
	return search === undefined ? params : { ...params, search };
}

/**
 * The href of the list at `url`'s path with `params`, for pager, page-size and search links.
 * It keeps the path, so it carries the admin's base path and works the same in a replaced
 * View. Only params that differ from their defaults are written (a blank search is none), and
 * every other search param is dropped.
 */
export function listHref(url: URL, params: ListParams): string {
	const search = new URLSearchParams();
	if (params.page !== 1) search.set('page', String(params.page));
	if (params.perPage !== DEFAULT_PER_PAGE) search.set('perPage', String(params.perPage));
	const q = searchOf(params.search);
	if (q !== undefined) search.set('q', q);
	const query = search.toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * Where a list URL should be rewritten to, or `undefined` when it is already clean. A URL is
 * clean when it names only known params with good values that differ from their defaults; the
 * order they are written in doesn't matter. `q` is known only for a searchable Resource. The
 * rewrite keeps the path and the hash.
 */
export function listUrlRewrite(
	url: URL,
	resource: Pick<Resource, 'searchable'>
): string | undefined {
	const clean = listHref(url, readListParams(url, resource));
	const cleanParams = new URL(clean, url).searchParams;
	cleanParams.sort();
	const params = new URLSearchParams(url.searchParams);
	params.sort();
	return params.toString() === cleanParams.toString() ? undefined : clean + url.hash;
}
