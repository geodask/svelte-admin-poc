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

/** Values a list param is left out of the encoding at, when they are given. */
export type ListParamDefaults = { page: number; perPage: number };

/** The defaults a list View's URL falls back to when it leaves a param out, and so leaves out. */
const URL_DEFAULTS: ListParamDefaults = { page: 1, perPage: DEFAULT_PER_PAGE };

/** How a list View's URL search params map to list params. */
const listUrlSchema = z.object({
	page: urlInt(pageParamSchemas.page, URL_DEFAULTS.page),
	perPage: urlInt(pageParamSchemas.perPage, URL_DEFAULTS.perPage)
});

/**
 * A search worth sending, or `undefined`. A blank one is no search. A real one is kept as
 * typed, spaces included, so a search box that writes the URL never has its text rewritten.
 */
function nonBlank(value: string | null | undefined): string | undefined {
	return value?.trim() ? value : undefined;
}

/**
 * The list params a list View's URL names, with defaults for what it leaves out. The search is
 * read from `q`, and only for a searchable Resource.
 */
export function readListParams<R extends Pick<Resource, 'searchable'>>(
	url: URL,
	resource: R
): ListParams<R> {
	const { searchParams } = url;
	const params: ListParams = listUrlSchema.parse({
		page: searchParams.get('page') ?? undefined,
		perPage: searchParams.get('perPage') ?? undefined
	});
	const search = resource.searchable ? nonBlank(searchParams.get('q')) : undefined;
	// A search only for a searchable Resource, as its type says.
	return (search === undefined ? params : { ...params, search }) as ListParams<R>;
}

/**
 * The one encoding of list params as search params, shared by the list URL and the bundled REST
 * Provider so the two can't drift: `page`, `perPage`, then the search as `q`. A blank search is
 * never written. Given `defaults`, a param at its default is left out too, as the list URL does;
 * without them every other param is written, as the REST Provider does, so a backend never has to
 * know the defaults. `readListParams` reads it back.
 */
export function encodeListParams(
	params: ListParams,
	defaults?: ListParamDefaults
): URLSearchParams {
	const encoded = new URLSearchParams();
	if (params.page !== defaults?.page) encoded.set('page', String(params.page));
	if (params.perPage !== defaults?.perPage) encoded.set('perPage', String(params.perPage));
	const q = nonBlank(params.search);
	if (q !== undefined) encoded.set('q', q);
	return encoded;
}

/**
 * The href of the list at `url`'s path with `params`, for pager, page-size and search links.
 * It keeps the path, so it carries the admin's base path and works the same in a replaced
 * View. Only params that differ from their defaults are written (a blank search is none), and
 * every other search param is dropped.
 */
export function listHref(url: URL, params: ListParams): string {
	const query = encodeListParams(params, URL_DEFAULTS).toString();
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
