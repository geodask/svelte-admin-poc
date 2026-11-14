import { z } from 'zod';
import { DEFAULT_PER_PAGE, listParamsSchema } from './list-params.ts';
import type { ListParams } from './provider.ts';

/**
 * A URL param of plain digits that must also pass `schema`, or `fallback` when it is missing
 * or bad. Only digits, so `2e1`, `0x2` and ` 2` are bad rather than read as numbers.
 */
function urlInt(schema: z.ZodInt, fallback: number) {
	return z.string().regex(/^\d+$/).transform(Number).pipe(schema).catch(fallback);
}

/** How a list View's URL search params map to list params. */
const listUrlSchema = z.object({
	page: urlInt(listParamsSchema.shape.page, 1),
	perPage: urlInt(listParamsSchema.shape.perPage, DEFAULT_PER_PAGE)
});

/** The list params a list View's URL names, with defaults for what it leaves out. */
export function readListParams(url: URL): ListParams {
	const { searchParams } = url;
	return listUrlSchema.parse({
		page: searchParams.get('page') ?? undefined,
		perPage: searchParams.get('perPage') ?? undefined
	});
}

/**
 * The href of the list at `url`'s path with `params`, for pager and page-size links. It keeps
 * the path, so it carries the admin's base path and works the same in a replaced View. Only
 * params that differ from their defaults are written, and every other search param is dropped.
 */
export function listHref(url: URL, params: ListParams): string {
	const search = new URLSearchParams();
	if (params.page !== 1) search.set('page', String(params.page));
	if (params.perPage !== DEFAULT_PER_PAGE) search.set('perPage', String(params.perPage));
	const query = search.toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * Where a list URL should be rewritten to, or `undefined` when it is already clean. A URL is
 * clean when it names only known params with good values that differ from their defaults; the
 * order they are written in doesn't matter. The rewrite keeps the path and the hash.
 */
export function listUrlRewrite(url: URL): string | undefined {
	const clean = listHref(url, readListParams(url));
	const cleanParams = new URL(clean, url).searchParams;
	cleanParams.sort();
	const params = new URLSearchParams(url.searchParams);
	params.sort();
	return params.toString() === cleanParams.toString() ? undefined : clean + url.hash;
}
