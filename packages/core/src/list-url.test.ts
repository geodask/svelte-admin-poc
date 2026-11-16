import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	encodeListParams,
	field,
	listHref,
	listUrlRewrite,
	readListParams,
	type Resource
} from '@svelte-admin/core';

// What matters to the list URL: whether a Resource is searchable, and which Fields are sortable.
const searchable = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	schema: z.object({ id: z.number(), name: z.string() })
});
const notSearchable = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});
const sortable = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true }),
		cuisine: z.string(),
		calories: field(z.number(), { sortable: true }).optional()
	})
});

const read = (search: string, resource: Resource = notSearchable) =>
	readListParams(new URL(`http://admin.test/admin/recipes${search}`), resource);

describe('the list URL helper', () => {
	describe('reading the list params', () => {
		it('falls back to page 1 and a page size of 25 when the URL names neither', () => {
			expect(read('')).toEqual({ page: 1, perPage: 25 });
		});

		it('reads the page and the page size the URL names', () => {
			expect(read('?page=3&perPage=50')).toEqual({ page: 3, perPage: 50 });
			expect(read('?perPage=100')).toEqual({ page: 1, perPage: 100 });
		});

		it.each(['abc', '', '0', '-2', '1.5', '2e1', '0x2', ' 2', '99999999999999999999'])(
			'falls back to the default for the bad value %j',
			(value) => {
				expect(read(`?page=${encodeURIComponent(value)}`)).toEqual({ page: 1, perPage: 25 });
				expect(read(`?perPage=${encodeURIComponent(value)}`)).toEqual({ page: 1, perPage: 25 });
			}
		);

		it('falls back to the default for a page size over the cap of 100', () => {
			expect(read('?perPage=101')).toEqual({ page: 1, perPage: 25 });
		});

		it('keeps a good value when the other one is bad', () => {
			expect(read('?page=abc&perPage=50')).toEqual({ page: 1, perPage: 50 });
			expect(read('?page=4&perPage=1000')).toEqual({ page: 4, perPage: 25 });
		});

		it('reads the search in q for a searchable Resource', () => {
			expect(read('?q=pasta', searchable)).toEqual({ page: 1, perPage: 25, search: 'pasta' });
			expect(read('?page=2&perPage=10&q=chicken+tacos', searchable)).toEqual({
				page: 2,
				perPage: 10,
				search: 'chicken tacos'
			});
		});

		it('keeps the search as typed, spaces included, so a search box never fights the URL', () => {
			expect(read('?q=%20pasta%20', searchable)).toEqual({
				page: 1,
				perPage: 25,
				search: ' pasta '
			});
		});

		it.each(['', '%20%20'])('reads no search from the empty q %j', (value) => {
			expect(read(`?q=${value}`, searchable)).toEqual({ page: 1, perPage: 25 });
		});

		it('ignores q for a Resource that is not searchable', () => {
			expect(read('?q=pasta')).toEqual({ page: 1, perPage: 25 });
		});
	});

	describe('writing a list href', () => {
		const url = new URL('http://admin.test/admin/recipes?page=2&perPage=50#rows');

		it('keeps the list path and names the page and the page size', () => {
			expect(listHref(url, { page: 3, perPage: 50 })).toBe('/admin/recipes?page=3&perPage=50');
		});

		it('leaves the defaults out of the URL', () => {
			expect(listHref(url, { page: 1, perPage: 25 })).toBe('/admin/recipes');
			expect(listHref(url, { page: 2, perPage: 25 })).toBe('/admin/recipes?page=2');
			expect(listHref(url, { page: 1, perPage: 10 })).toBe('/admin/recipes?perPage=10');
		});

		it('drops params the list does not know', () => {
			const withJunk = new URL('http://admin.test/admin/recipes?foo=1&limit=100000');
			expect(listHref(withJunk, { page: 2, perPage: 25 })).toBe('/admin/recipes?page=2');
		});

		it('names the search in q, after the page and the page size', () => {
			expect(listHref(url, { page: 1, perPage: 25, search: 'pasta' })).toBe(
				'/admin/recipes?q=pasta'
			);
			expect(listHref(url, { page: 2, perPage: 10, search: 'chicken tacos' })).toBe(
				'/admin/recipes?page=2&perPage=10&q=chicken+tacos'
			);
		});

		it('leaves an empty search out of the URL', () => {
			expect(listHref(url, { page: 1, perPage: 10, search: '' })).toBe('/admin/recipes?perPage=10');
			expect(listHref(url, { page: 1, perPage: 10, search: '  ' })).toBe(
				'/admin/recipes?perPage=10'
			);
		});

		it('reads back as the params it was written from', () => {
			const params = { page: 7, perPage: 100, search: 'pasta & co' };
			expect(read(listHref(url, params).replace('/admin/recipes', ''), searchable)).toEqual(params);
		});
	});

	describe('encoding list params', () => {
		const urlDefaults = { page: 1, perPage: 25, order: 'asc' } as const;
		const encode = (...args: Parameters<typeof encodeListParams>) =>
			encodeListParams(...args).toString();

		it('writes page, perPage and q, in that order, as the list href does', () => {
			expect(encode({ page: 2, perPage: 10, search: 'chicken tacos' }, urlDefaults)).toBe(
				'page=2&perPage=10&q=chicken+tacos'
			);
			expect(
				listHref(new URL('http://admin.test/admin/recipes'), {
					page: 2,
					perPage: 10,
					search: 'chicken tacos'
				})
			).toBe('/admin/recipes?page=2&perPage=10&q=chicken+tacos');
		});

		it('leaves out what is at its default, and a blank search', () => {
			expect(encode({ page: 1, perPage: 25 }, urlDefaults)).toBe('');
			expect(encode({ page: 1, perPage: 50, search: '  ' }, urlDefaults)).toBe('perPage=50');
			expect(encode({ page: 3, perPage: 25, search: 'pasta' }, urlDefaults)).toBe('page=3&q=pasta');
		});

		it('writes every param when given no defaults', () => {
			expect(encode({ page: 1, perPage: 25 })).toBe('page=1&perPage=25');
			expect(encode({ page: 1, perPage: 25, search: 'chicken & rice' })).toBe(
				'page=1&perPage=25&q=chicken+%26+rice'
			);
		});

		it.each([
			{ page: 1, perPage: 25 },
			{ page: 4, perPage: 100 },
			{ page: 1, perPage: 10, search: 'pasta & co' },
			{ page: 7, perPage: 25, search: ' spaced ' }
		])('reads back through readListParams as %j', (params) => {
			for (const defaults of [urlDefaults, undefined]) {
				expect(read(`?${encode(params, defaults)}`, searchable)).toEqual(params);
			}
		});
	});

	describe('rewriting a list URL', () => {
		const rewrite = (search: string, resource: Resource = notSearchable) =>
			listUrlRewrite(new URL(`http://admin.test/admin/recipes${search}`), resource);

		it('leaves a URL alone when it names only good values that differ from the defaults', () => {
			expect(rewrite('')).toBeUndefined();
			expect(rewrite('?page=2')).toBeUndefined();
			expect(rewrite('?page=2&perPage=50')).toBeUndefined();
		});

		it('leaves the params in the order they were written', () => {
			expect(rewrite('?perPage=50&page=2')).toBeUndefined();
		});

		it('drops unknown params and bad values', () => {
			expect(rewrite('?page=abc&foo=1')).toBe('/admin/recipes');
			expect(rewrite('?page=2&perPage=1000')).toBe('/admin/recipes?page=2');
			expect(rewrite('?page=3&limit=100000')).toBe('/admin/recipes?page=3');
		});

		it('drops values that are the defaults', () => {
			expect(rewrite('?page=1')).toBe('/admin/recipes');
			expect(rewrite('?page=1&perPage=25')).toBe('/admin/recipes');
		});

		it('writes a value in its plain form', () => {
			expect(rewrite('?page=02')).toBe('/admin/recipes?page=2');
		});

		it('keeps only the first of a repeated param', () => {
			expect(rewrite('?page=2&page=3')).toBe('/admin/recipes?page=2');
		});

		it('keeps the hash', () => {
			expect(rewrite('?foo=1#rows')).toBe('/admin/recipes#rows');
		});

		it('leaves a search alone on a searchable Resource', () => {
			expect(rewrite('?q=pasta', searchable)).toBeUndefined();
			expect(rewrite('?q=pasta&page=2', searchable)).toBeUndefined();
			expect(rewrite('?q=chicken%20tacos', searchable)).toBeUndefined();
		});

		it('drops an empty search', () => {
			expect(rewrite('?q=', searchable)).toBe('/admin/recipes');
			expect(rewrite('?perPage=10&q=', searchable)).toBe('/admin/recipes?perPage=10');
		});

		it('drops q on a Resource that is not searchable', () => {
			expect(rewrite('?q=pasta&page=2')).toBe('/admin/recipes?page=2');
		});
	});

	describe('the sort', () => {
		const at = (search: string) => new URL(`http://admin.test/admin/recipes${search}`);
		const readSorted = (search: string) => read(search, sortable);
		const rewrite = (search: string) => listUrlRewrite(at(search), sortable);

		it('is read from sort, ascending unless order says desc', () => {
			expect(readSorted('?sort=name')).toEqual({
				page: 1,
				perPage: 25,
				sort: { field: 'name', order: 'asc' }
			});
			expect(readSorted('?sort=calories&order=desc')).toEqual({
				page: 1,
				perPage: 25,
				sort: { field: 'calories', order: 'desc' }
			});
			expect(readSorted('?order=desc&sort=name')).toMatchObject({
				sort: { field: 'name', order: 'desc' }
			});
			expect(readSorted('?sort=name&order=asc')).toMatchObject({
				sort: { field: 'name', order: 'asc' }
			});
		});

		it('reads ascending for an order that is neither asc nor desc', () => {
			expect(readSorted('?sort=name&order=DESC')).toMatchObject({
				sort: { field: 'name', order: 'asc' }
			});
		});

		it.each([
			['a Field that is not sortable', '?sort=cuisine&order=desc'],
			['a Field the Resource does not have', '?sort=rating'],
			['an empty sort', '?sort=&order=desc'],
			['an order without a sort', '?order=desc']
		])('is dropped for %s', (_, search) => {
			expect(readSorted(search)).toEqual({ page: 1, perPage: 25 });
		});

		it('is ignored on a Resource with no sortable Field', () => {
			expect(read('?sort=name&order=desc', searchable)).toEqual({ page: 1, perPage: 25 });
		});

		it('keeps only the first of a repeated sort', () => {
			expect(readSorted('?sort=calories&sort=name')).toMatchObject({
				sort: { field: 'calories', order: 'asc' }
			});
		});

		it('is written after the page size and before the search, with order only for desc', () => {
			const url = at('?page=2');
			expect(listHref(url, { page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } })).toBe(
				'/admin/recipes?sort=name'
			);
			expect(
				listHref(url, {
					page: 2,
					perPage: 10,
					search: 'pasta',
					sort: { field: 'calories', order: 'desc' }
				})
			).toBe('/admin/recipes?page=2&perPage=10&sort=calories&order=desc&q=pasta');
		});

		it('always writes the order when given no defaults, as the REST Provider sends it', () => {
			const encode = (params: Parameters<typeof encodeListParams>[0]) =>
				encodeListParams(params).toString();
			expect(encode({ page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } })).toBe(
				'page=1&perPage=25&sort=name&order=asc'
			);
			expect(encode({ page: 1, perPage: 25, sort: { field: 'name', order: 'desc' } })).toBe(
				'page=1&perPage=25&sort=name&order=desc'
			);
			expect(encode({ page: 1, perPage: 25 })).toBe('page=1&perPage=25');
		});

		it.each([
			{ page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } },
			{ page: 3, perPage: 10, sort: { field: 'calories', order: 'desc' } },
			{ page: 1, perPage: 25, search: 'pasta', sort: { field: 'name', order: 'desc' } }
		] as const)('reads back through listHref as %j', (params) => {
			expect(readSorted(listHref(at(''), params).replace('/admin/recipes', ''))).toEqual(params);
		});

		it('leaves a clean sorted URL alone, in any param order', () => {
			expect(rewrite('?sort=name')).toBeUndefined();
			expect(rewrite('?sort=name&order=desc')).toBeUndefined();
			expect(rewrite('?order=desc&page=2&sort=calories&q=pasta')).toBeUndefined();
		});

		it.each([
			['order=asc, the default', '?sort=name&order=asc', '/admin/recipes?sort=name'],
			[
				'a sort on a Field that is not sortable',
				'?sort=cuisine&order=desc&page=2',
				'/admin/recipes?page=2'
			],
			['a sort on an unknown Field', '?sort=rating', '/admin/recipes'],
			['an order without a sort', '?order=desc&q=pasta', '/admin/recipes?q=pasta'],
			['an order that is neither asc nor desc', '?sort=name&order=up', '/admin/recipes?sort=name']
		])('rewrites a URL with %s', (_, search, clean) => {
			expect(rewrite(search)).toBe(clean);
		});

		it('drops the sort on a Resource with no sortable Field', () => {
			expect(listUrlRewrite(at('?sort=name&order=desc'), searchable)).toBe('/admin/recipes');
		});
	});
});
