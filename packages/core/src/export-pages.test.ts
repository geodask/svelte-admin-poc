import { describe, expect, it } from 'vitest';
import { MAX_PER_PAGE, type ListResult } from '@svelte-admin/core';
import { collectPages } from '@svelte-admin/core/export';

/** Records 1 to `count`, as ids. */
const ids = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

/**
 * A fake backend's pages over `count` records, answered with a `total` or with `hasNextPage`,
 * recording each page and page size it is asked for.
 */
function backend(count: number, answer: 'total' | 'hasNextPage') {
	const asked: [page: number, perPage: number][] = [];
	const records = ids(count);
	const getPage = async (page: number, perPage: number): Promise<ListResult<number>> => {
		asked.push([page, perPage]);
		const start = (page - 1) * perPage;
		const data = records.slice(start, start + perPage);
		return answer === 'total'
			? { data, total: count }
			: { data, hasNextPage: start + perPage < count };
	};
	return { asked, getPage };
}

describe('collecting every page of a list for an export', () => {
	it.each(['total', 'hasNextPage'] as const)(
		'reads page after page of MAX_PER_PAGE until the last one, answered with %s',
		async (answer) => {
			const { asked, getPage } = backend(230, answer);

			const collected = await collectPages(getPage, 10_000);

			expect(collected.records).toEqual(ids(230));
			expect(collected.capped).toBe(false);
			expect(asked).toEqual([
				[1, MAX_PER_PAGE],
				[2, MAX_PER_PAGE],
				[3, MAX_PER_PAGE]
			]);
		}
	);

	it('gives the total when the backend counts, and none when it can’t', async () => {
		expect((await collectPages(backend(5, 'total').getPage, 100)).total).toBe(5);
		expect(await collectPages(backend(5, 'hasNextPage').getPage, 100)).not.toHaveProperty('total');
	});

	it('stops when the total is reached, without asking for an empty page', async () => {
		const { asked, getPage } = backend(200, 'total');

		const collected = await collectPages(getPage, 10_000);

		expect(collected.records).toHaveLength(200);
		expect(asked).toEqual([
			[1, MAX_PER_PAGE],
			[2, MAX_PER_PAGE]
		]);
	});

	it('stops at a page that comes back short, whatever the backend says', async () => {
		const asked: number[] = [];
		const collected = await collectPages(async (page) => {
			asked.push(page);
			return { data: page === 1 ? ids(MAX_PER_PAGE) : [1, 2, 3], hasNextPage: true };
		}, 10_000);

		expect(collected.records).toHaveLength(MAX_PER_PAGE + 3);
		expect(asked).toEqual([1, 2]);
	});

	it('stops at an empty page', async () => {
		const collected = await collectPages(async () => ({ data: [], hasNextPage: true }), 10_000);

		expect(collected).toEqual({ records: [], capped: false });
	});

	it('stops at the cap, keeping the first records, and says there were more', async () => {
		const { asked, getPage } = backend(230, 'total');

		const collected = await collectPages(getPage, 150);

		expect(collected).toEqual({ records: ids(150), capped: true, total: 230 });
		expect(asked).toEqual([
			[1, MAX_PER_PAGE],
			[2, MAX_PER_PAGE]
		]);
	});

	it('asks for pages no larger than a cap below MAX_PER_PAGE', async () => {
		const { asked, getPage } = backend(60, 'hasNextPage');

		const collected = await collectPages(getPage, 50);

		expect(collected).toEqual({ records: ids(50), capped: true });
		expect(asked).toEqual([[1, 50]]);
	});

	it('isn’t capped when the records end exactly at the cap', async () => {
		expect(await collectPages(backend(50, 'hasNextPage').getPage, 50)).toEqual({
			records: ids(50),
			capped: false
		});
		expect(await collectPages(backend(200, 'total').getPage, 200)).toEqual({
			records: ids(200),
			capped: false,
			total: 200
		});
	});

	it('fails as a whole when any page fails', async () => {
		const failure = new Error('Backend down');

		await expect(
			collectPages(async (page) => {
				if (page === 2) throw failure;
				return { data: ids(MAX_PER_PAGE), hasNextPage: true };
			}, 10_000)
		).rejects.toBe(failure);
	});
});
