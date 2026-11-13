import { z } from 'zod';

/** The largest page size `getList` accepts. */
export const MAX_PER_PAGE = 100;

/** The page size a list View uses when the URL doesn't name one. */
export const DEFAULT_PER_PAGE = 25;

/**
 * The input schema of every Resource's `getList` query. It is strict: an undeclared key is
 * invalid input, so a Provider never sees one, and nothing is coerced.
 */
export const listParamsSchema = z.strictObject({
	page: z.int().min(1),
	perPage: z.int().min(1).max(MAX_PER_PAGE)
});
