import { MAX_PER_PAGE } from './list-params.ts';
import type { ListResult } from './provider.ts';

/**
 * What `collectPages` gathered: the records, in order, at most the cap; whether it stopped at the
 * cap with more records left; and the total the Provider counted, when it counts.
 */
export type CollectedPages<T> = { records: T[]; capped: boolean; total?: number };

/**
 * Every record of a list, read page after page from page 1 with `getPage(page, perPage)`, up to
 * `maxRows` records. Pages hold `MAX_PER_PAGE` records, or `maxRows` when that is smaller, so it
 * never asks for more than it keeps. It stops at the last page (the `total` is reached,
 * `hasNextPage` is false, or a page comes back short) or at the cap, keeping the first `maxRows`
 * records. A page that fails fails the whole collection: it rejects with that failure, and keeps
 * nothing.
 */
export async function collectPages<T>(
	getPage: (page: number, perPage: number) => Promise<ListResult<T>>,
	maxRows: number
): Promise<CollectedPages<T>> {
	const perPage = Math.min(MAX_PER_PAGE, maxRows);
	const records: T[] = [];
	let total: number | undefined;
	let more = true;
	for (let page = 1; more && records.length < maxRows; page++) {
		const result = await getPage(page, perPage);
		records.push(...result.data);
		if ('total' in result) total = result.total;
		more =
			result.data.length === perPage &&
			('total' in result ? page * perPage < result.total : result.hasNextPage);
	}
	const collected = {
		records: records.slice(0, maxRows),
		capped: records.length > maxRows || more
	};
	return total === undefined ? collected : { ...collected, total };
}
