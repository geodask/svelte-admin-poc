import { z } from 'zod';
import type { ListParams } from './provider.ts';
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

/**
 * The input schema of a Resource's `getList` query: a page and a page size, plus a search only
 * when the Resource is searchable. It is strict: an undeclared key (a search included, for a
 * Resource that isn't searchable) is invalid input, so a Provider never sees one, and nothing is
 * coerced.
 */
export function listParamsSchema(resource: Pick<Resource, 'searchable'>): z.ZodType<ListParams> {
	return resource.searchable ? searchableListParams : pageParams;
}

/** The schemas of the page and the page size, for reading them from a URL. */
export const pageParamSchemas = pageParams.shape;
