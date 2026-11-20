import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	encodeListParams,
	field,
	listHref,
	listUrlRewrite,
	readListParams,
	type ListParams,
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
			expect(listHref(url, { page: 3, perPage: 50 }, notSearchable)).toBe(
				'/admin/recipes?page=3&perPage=50'
			);
		});

		it('leaves the defaults out of the URL', () => {
			expect(listHref(url, { page: 1, perPage: 25 }, notSearchable)).toBe('/admin/recipes');
			expect(listHref(url, { page: 2, perPage: 25 }, notSearchable)).toBe('/admin/recipes?page=2');
			expect(listHref(url, { page: 1, perPage: 10 }, notSearchable)).toBe(
				'/admin/recipes?perPage=10'
			);
		});

		it('drops params the list does not know', () => {
			const withJunk = new URL('http://admin.test/admin/recipes?foo=1&limit=100000');
			expect(listHref(withJunk, { page: 2, perPage: 25 }, notSearchable)).toBe(
				'/admin/recipes?page=2'
			);
		});

		it('names the search in q, after the page and the page size', () => {
			expect(listHref(url, { page: 1, perPage: 25, search: 'pasta' }, searchable)).toBe(
				'/admin/recipes?q=pasta'
			);
			expect(listHref(url, { page: 2, perPage: 10, search: 'chicken tacos' }, searchable)).toBe(
				'/admin/recipes?page=2&perPage=10&q=chicken+tacos'
			);
		});

		it('leaves an empty search out of the URL', () => {
			expect(listHref(url, { page: 1, perPage: 10, search: '' }, searchable)).toBe(
				'/admin/recipes?perPage=10'
			);
			expect(listHref(url, { page: 1, perPage: 10, search: '  ' }, searchable)).toBe(
				'/admin/recipes?perPage=10'
			);
		});

		it('reads back as the params it was written from', () => {
			const params = { page: 7, perPage: 100, search: 'pasta & co' };
			expect(
				read(listHref(url, params, searchable).replace('/admin/recipes', ''), searchable)
			).toEqual(params);
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
				listHref(
					new URL('http://admin.test/admin/recipes'),
					{ page: 2, perPage: 10, search: 'chicken tacos' },
					searchable
				)
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
			expect(
				listHref(url, { page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } }, sortable)
			).toBe('/admin/recipes?sort=name');
			expect(
				listHref(
					url,
					{ page: 2, perPage: 10, search: 'pasta', sort: { field: 'calories', order: 'desc' } },
					sortable
				)
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
			expect(readSorted(listHref(at(''), params, sortable).replace('/admin/recipes', ''))).toEqual(
				params
			);
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

	describe("a Resource's default sort and page size", () => {
		// Newest first, at 20 rows a page: like the demo's posts.
		const posts = defineResource({
			name: 'posts',
			label: 'Posts',
			schema: z.object({
				id: field(z.number(), { sortable: true }),
				title: field(z.string(), { sortable: true })
			}),
			defaultSort: { field: 'id', order: 'desc' },
			perPage: 20
		});
		// Sorted ascending by default, at the stock page size.
		const users = defineResource({
			name: 'users',
			label: 'Users',
			searchable: true,
			schema: z.object({ id: z.number(), name: field(z.string(), { sortable: true }) }),
			defaultSort: { field: 'name', order: 'asc' }
		});
		const at = (search: string, resource: Resource = posts) =>
			new URL(`http://admin.test/admin/${resource.name}${search}`);
		const readPosts = (search: string) => readListParams(at(search), posts);
		const href = (params: Parameters<typeof listHref>[1], resource: Resource = posts) =>
			listHref(at('?page=2', resource), params, resource);
		const rewrite = (search: string, resource: Resource = posts) =>
			listUrlRewrite(at(search, resource), resource);
		const newestFirst = { field: 'id', order: 'desc' } as const;

		it('are what a URL that names neither reads as', () => {
			expect(readPosts('')).toEqual({ page: 1, perPage: 20, sort: newestFirst });
			expect(readListParams(at('', users), users)).toEqual({
				page: 1,
				perPage: 25,
				sort: { field: 'name', order: 'asc' }
			});
		});

		it('give way to a page size and a sort the URL names', () => {
			expect(readPosts('?perPage=25&sort=title')).toEqual({
				page: 1,
				perPage: 25,
				sort: { field: 'title', order: 'asc' }
			});
			expect(readPosts('?sort=id')).toMatchObject({ sort: { field: 'id', order: 'asc' } });
		});

		it.each(['0', '101', 'abc'])('are what a bad page size %j falls back to', (perPage) => {
			expect(readPosts(`?perPage=${perPage}`)).toEqual({ page: 1, perPage: 20, sort: newestFirst });
		});

		it.each(['?sort=rating', '?order=asc', '?sort=&order=asc'])(
			'are what a sort the URL cannot use, %j, falls back to',
			(search) => {
				expect(readPosts(search)).toEqual({ page: 1, perPage: 20, sort: newestFirst });
			}
		);

		it('are left out of a list href', () => {
			expect(href({ page: 1, perPage: 20, sort: newestFirst })).toBe('/admin/posts');
			expect(href({ page: 3, perPage: 20, sort: newestFirst })).toBe('/admin/posts?page=3');
			expect(href({ page: 1, perPage: 20 })).toBe('/admin/posts');
			expect(href({ page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } }, users)).toBe(
				'/admin/users'
			);
		});

		it('leave the rest of a list href written out', () => {
			// The stock page size isn't this Resource's own, so it is written.
			expect(href({ page: 1, perPage: 25, sort: newestFirst })).toBe('/admin/posts?perPage=25');
			// The default sort's Field the other way round, or another Field, is written.
			expect(href({ page: 1, perPage: 20, sort: { field: 'id', order: 'asc' } })).toBe(
				'/admin/posts?sort=id'
			);
			expect(href({ page: 1, perPage: 20, sort: { field: 'title', order: 'desc' } })).toBe(
				'/admin/posts?sort=title&order=desc'
			);
			expect(href({ page: 1, perPage: 25, sort: { field: 'name', order: 'desc' } }, users)).toBe(
				'/admin/users?sort=name&order=desc'
			);
		});

		it.each([
			{ page: 1, perPage: 20, sort: newestFirst },
			{ page: 2, perPage: 25, sort: newestFirst },
			{ page: 1, perPage: 20, sort: { field: 'id', order: 'asc' } },
			{ page: 4, perPage: 10, sort: { field: 'title', order: 'desc' } }
		] as const)('read back through listHref as %j', (params) => {
			expect(readPosts(href(params).replace('/admin/posts', ''))).toEqual(params);
		});

		it.each([
			['the default sort', '?sort=id&order=desc', '/admin/posts'],
			["the Resource's page size", '?perPage=20', '/admin/posts'],
			['both, beside a page', '?perPage=20&sort=id&order=desc&page=2', '/admin/posts?page=2']
		])('are cleaned out of a URL that writes out %s', (_, search, clean) => {
			expect(rewrite(search)).toBe(clean);
		});

		it('are cleaned out of a URL that writes out an ascending default sort', () => {
			expect(rewrite('?sort=name', users)).toBe('/admin/users');
			expect(rewrite('?sort=name&order=asc&q=ann', users)).toBe('/admin/users?q=ann');
		});

		it('leave a URL alone that names another page size or sort', () => {
			expect(rewrite('?perPage=25')).toBeUndefined();
			expect(rewrite('?sort=id')).toBeUndefined();
			expect(rewrite('?sort=title&order=desc')).toBeUndefined();
			expect(rewrite('?sort=name&order=desc', users)).toBeUndefined();
		});
	});

	describe('the filters', () => {
		// Like the demo's recipes: an enum and a boolean to filter by, with a search and a sort.
		const filterable = defineResource({
			name: 'recipes',
			label: 'Recipes',
			searchable: true,
			schema: z.object({
				id: z.number(),
				name: field(z.string(), { sortable: true }),
				difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
				// Narrowed to `eq`, so it never takes several values.
				course: field(z.enum(['main', 'dessert']), { filterable: ['eq'] }),
				vegetarian: field(z.boolean(), { filterable: true }).optional(),
				// Hidden Fields can still be filtered by from the URL.
				archived: field(z.boolean(), { hidden: true, filterable: true }),
				cuisine: z.string()
			})
		});
		const at = (search: string) => new URL(`http://admin.test/admin/recipes${search}`);
		const readFiltered = (search: string) => readListParams(at(search), filterable);
		const filtersIn = (search: string) => readFiltered(search).filters;
		const href = (params: Parameters<typeof listHref>[1]) =>
			listHref(at('?page=2'), params, filterable);
		const rewrite = (search: string) => listUrlRewrite(at(search), filterable);

		it('read a bare param as eq', () => {
			expect(readFiltered('?difficulty=Easy')).toEqual({
				page: 1,
				perPage: 25,
				filters: [{ field: 'difficulty', operator: 'eq', value: 'Easy' }]
			});
			expect(filtersIn('?vegetarian=false')).toEqual([
				{ field: 'vegetarian', operator: 'eq', value: false }
			]);
			expect(filtersIn('?archived=true')).toEqual([
				{ field: 'archived', operator: 'eq', value: true }
			]);
		});

		it('read a repeated param as in, with the values in the enum order', () => {
			expect(filtersIn('?difficulty=Hard&difficulty=Easy')).toEqual([
				{ field: 'difficulty', operator: 'in', value: ['Easy', 'Hard'] }
			]);
		});

		it('read a repeated param that holds one value twice as eq', () => {
			expect(filtersIn('?difficulty=Easy&difficulty=Easy')).toEqual([
				{ field: 'difficulty', operator: 'eq', value: 'Easy' }
			]);
		});

		it('read only the first value of a repeated param on a Field without in', () => {
			expect(filtersIn('?course=dessert&course=main')).toEqual([
				{ field: 'course', operator: 'eq', value: 'dessert' }
			]);
			expect(filtersIn('?vegetarian=true&vegetarian=false')).toEqual([
				{ field: 'vegetarian', operator: 'eq', value: true }
			]);
		});

		it('are combined, in schema order, whatever order the URL names them in', () => {
			expect(filtersIn('?vegetarian=true&difficulty=Medium&difficulty=Easy&course=main')).toEqual([
				{ field: 'difficulty', operator: 'in', value: ['Easy', 'Medium'] },
				{ field: 'course', operator: 'eq', value: 'main' },
				{ field: 'vegetarian', operator: 'eq', value: true }
			]);
		});

		it.each([
			['an unknown Field', '?rating=5'],
			['a Field that is not filterable', '?cuisine=Thai'],
			['an empty value', '?difficulty=&vegetarian='],
			['a value that is not an enum member', '?difficulty=Spicy'],
			['an enum member in the wrong case', '?difficulty=easy'],
			['a boolean that is not true or false', '?vegetarian=yes&archived=1'],
			['an operator suffix the Field does not allow', '?difficulty.contains=Ea'],
			['an unknown operator suffix', '?vegetarian.ne=true']
		])('drop %s', (_, search) => {
			expect(readFiltered(search)).toEqual({ page: 1, perPage: 25 });
		});

		it('drop the bad values of a repeated param and keep the good ones', () => {
			expect(filtersIn('?difficulty=Easy&difficulty=&difficulty=Spicy')).toEqual([
				{ field: 'difficulty', operator: 'eq', value: 'Easy' }
			]);
		});

		it('are ignored on a Resource with no filterable Field', () => {
			expect(read('?difficulty=Easy&vegetarian=true', searchable)).toEqual({
				page: 1,
				perPage: 25
			});
		});

		it('are written after the search, eq as a bare param and in as a repeated one', () => {
			expect(
				href({
					page: 1,
					perPage: 10,
					search: 'pasta',
					sort: { field: 'name', order: 'desc' },
					filters: [
						{ field: 'difficulty', operator: 'in', value: ['Easy', 'Medium'] },
						{ field: 'vegetarian', operator: 'eq', value: true }
					]
				})
			).toBe(
				'/admin/recipes?perPage=10&sort=name&order=desc&q=pasta&difficulty=Easy&difficulty=Medium&vegetarian=true'
			);
		});

		it('leave out an empty list of filters', () => {
			expect(href({ page: 1, perPage: 25, filters: [] })).toBe('/admin/recipes');
		});

		it('are written by the shared encoder with every other param, as the REST Provider sends them', () => {
			expect(
				encodeListParams({
					page: 1,
					perPage: 25,
					filters: [
						{ field: 'difficulty', operator: 'eq', value: 'Hard' },
						{ field: 'vegetarian', operator: 'eq', value: false }
					]
				}).toString()
			).toBe('page=1&perPage=25&difficulty=Hard&vegetarian=false');
		});

		it.each([
			{ page: 1, perPage: 25, filters: [{ field: 'difficulty', operator: 'eq', value: 'Easy' }] },
			{
				page: 3,
				perPage: 10,
				search: 'chicken',
				sort: { field: 'name', order: 'asc' },
				filters: [
					{ field: 'difficulty', operator: 'in', value: ['Easy', 'Medium', 'Hard'] },
					{ field: 'course', operator: 'eq', value: 'dessert' },
					{ field: 'vegetarian', operator: 'eq', value: false },
					{ field: 'archived', operator: 'eq', value: true }
				]
			}
		] satisfies ListParams[])('read back through listHref as %j', (params) => {
			expect(readFiltered(href(params).replace('/admin/recipes', ''))).toEqual(params);
		});

		it('leave a clean filtered URL alone, in any param order', () => {
			expect(rewrite('?difficulty=Easy')).toBeUndefined();
			expect(rewrite('?vegetarian=false&difficulty=Easy&difficulty=Hard&page=2')).toBeUndefined();
			expect(rewrite('?q=pasta&difficulty=Medium&sort=name')).toBeUndefined();
		});

		it.each([
			['an unknown filter', '?rating=5&difficulty=Easy', '/admin/recipes?difficulty=Easy'],
			['a bad enum value', '?difficulty=Spicy&page=2', '/admin/recipes?page=2'],
			['a boolean that is not true or false', '?vegetarian=', '/admin/recipes'],
			[
				'empty params from a form',
				'?q=&difficulty=Easy&vegetarian=',
				'/admin/recipes?difficulty=Easy'
			],
			[
				'in values out of order',
				'?difficulty=Hard&difficulty=Easy',
				'/admin/recipes?difficulty=Easy&difficulty=Hard'
			],
			['a value repeated', '?difficulty=Easy&difficulty=Easy', '/admin/recipes?difficulty=Easy']
		])('rewrite a URL with %s', (_, search, clean) => {
			expect(rewrite(search)).toBe(clean);
		});
	});

	describe('the text, number and date filters', () => {
		// Like the demo's recipes, with a date Field of each type.
		const ranged = defineResource({
			name: 'recipes',
			label: 'Recipes',
			searchable: true,
			schema: z.object({
				id: z.number(),
				// A refinement that a filter value isn't held to.
				name: field(z.string().min(5), { filterable: true }),
				// Narrowed: exact text only, never `contains`.
				cuisine: field(z.string(), { filterable: ['eq', 'in'] }),
				prepTimeMinutes: field(z.number(), { filterable: true }),
				publishedAt: field(z.iso.datetime(), { filterable: true }),
				cookedOn: field(z.iso.date(), { filterable: true }).optional(),
				bakedOn: field(z.date(), { filterable: true }).nullable(),
				// Narrowed to a range: no `eq`.
				calories: field(z.number(), { filterable: ['gte', 'lte'] }).optional()
			})
		});
		const at = (search: string) => new URL(`http://admin.test/admin/recipes${search}`);
		const filtersIn = (search: string) => readListParams(at(search), ranged).filters;
		const href = (params: Parameters<typeof listHref>[1]) =>
			listHref(at('?page=2'), params, ranged);
		const rewrite = (search: string) => listUrlRewrite(at(search), ranged);

		it('read text with contains, eq and in, as typed', () => {
			expect(filtersIn('?name.contains=piz')).toEqual([
				{ field: 'name', operator: 'contains', value: 'piz' }
			]);
			expect(filtersIn('?name=Pizza%20Night&name.contains=%20piz')).toEqual([
				{ field: 'name', operator: 'eq', value: 'Pizza Night' },
				{ field: 'name', operator: 'contains', value: ' piz' }
			]);
			expect(filtersIn('?cuisine=Thai&cuisine=Italian')).toEqual([
				{ field: 'cuisine', operator: 'in', value: ['Italian', 'Thai'] }
			]);
		});

		it('read numbers as plain decimals with every operator', () => {
			expect(
				filtersIn(
					'?prepTimeMinutes=15&prepTimeMinutes.lt=60&prepTimeMinutes.lte=45.5&prepTimeMinutes.gt=-5&prepTimeMinutes.gte=0.5'
				)
			).toEqual([
				{ field: 'prepTimeMinutes', operator: 'eq', value: 15 },
				{ field: 'prepTimeMinutes', operator: 'lt', value: 60 },
				{ field: 'prepTimeMinutes', operator: 'lte', value: 45.5 },
				{ field: 'prepTimeMinutes', operator: 'gt', value: -5 },
				{ field: 'prepTimeMinutes', operator: 'gte', value: 0.5 }
			]);
		});

		it('read a date into the Field type, as its date input sends it', () => {
			// Every rule for reading a date input is the input codec's, and tested with it.
			expect(
				filtersIn('?publishedAt.gte=2024-03-01T23:30&cookedOn.lt=2024-03-01&bakedOn.gte=2024-02-29')
			).toEqual([
				{ field: 'publishedAt', operator: 'gte', value: '2024-03-01T23:30:00.000Z' },
				{ field: 'cookedOn', operator: 'lt', value: '2024-03-01' },
				{ field: 'bakedOn', operator: 'gte', value: new Date('2024-02-29T00:00:00Z') }
			]);
		});

		it.each([
			// Every rule for reading a number input is the input codec's, and tested with it.
			['a number that is not a number', '?prepTimeMinutes.gte=abc'],
			['an empty number', '?prepTimeMinutes.gte=&prepTimeMinutes.lte='],
			['blank text', '?name.contains=&name=%20%20'],
			['contains on a Field narrowed to eq and in', '?cuisine.contains=Ital'],
			['an operator text does not have', '?name.gte=a'],
			['an operator number does not have', '?prepTimeMinutes.contains=1'],
			['eq on a Field narrowed to a range', '?calories=300'],
			[
				'a date that does not exist, of each type',
				'?publishedAt.gte=2024-02-30T00:00&cookedOn=2024-02-30&bakedOn=2024-02-30'
			]
		])('drop %s', (_, search) => {
			expect(filtersIn(search)).toBeUndefined();
		});

		it('write each operator, numbers as plain decimals and dates as the input sends them', () => {
			expect(
				href({
					page: 1,
					perPage: 25,
					filters: [
						{ field: 'name', operator: 'contains', value: 'piz' },
						{ field: 'prepTimeMinutes', operator: 'lt', value: 60 },
						{ field: 'prepTimeMinutes', operator: 'gte', value: 0.5 },
						{ field: 'publishedAt', operator: 'gt', value: '2024-03-01T10:30:00.000Z' },
						{ field: 'publishedAt', operator: 'lte', value: '2024-03-31T23:30:15.000Z' },
						{ field: 'cookedOn', operator: 'eq', value: '2024-03-01' },
						{ field: 'bakedOn', operator: 'lte', value: new Date('2024-02-29T00:00:00Z') }
					]
				})
			).toBe(
				'/admin/recipes?name.contains=piz&prepTimeMinutes.lt=60&prepTimeMinutes.gte=0.5' +
					'&publishedAt.gt=2024-03-01T10%3A30&publishedAt.lte=2024-03-31T23%3A30%3A15' +
					'&cookedOn=2024-03-01&bakedOn.lte=2024-02-29'
			);
		});

		it('are written by the shared encoder with dates in their own type, a Date as an ISO string', () => {
			expect(
				encodeListParams({
					page: 1,
					perPage: 25,
					filters: [
						{ field: 'name', operator: 'contains', value: 'piz' },
						{ field: 'publishedAt', operator: 'gte', value: '2024-03-01T10:30:00.000Z' },
						{ field: 'bakedOn', operator: 'lt', value: new Date('2024-02-29T00:00:00Z') }
					]
				}).toString()
			).toBe(
				'page=1&perPage=25&name.contains=piz&publishedAt.gte=2024-03-01T10%3A30%3A00.000Z' +
					'&bakedOn.lt=2024-02-29T00%3A00%3A00.000Z'
			);
		});

		it.each([
			{
				page: 1,
				perPage: 25,
				filters: [{ field: 'name', operator: 'contains', value: 'Pizza & Pasta?' }]
			},
			{
				page: 2,
				perPage: 10,
				search: 'chicken',
				filters: [
					{ field: 'name', operator: 'eq', value: 'Pad Thai' },
					{ field: 'name', operator: 'contains', value: 'thai' },
					{ field: 'cuisine', operator: 'in', value: ['Italian', 'Thai'] },
					{ field: 'prepTimeMinutes', operator: 'eq', value: 15 },
					{ field: 'prepTimeMinutes', operator: 'lt', value: 60 },
					{ field: 'prepTimeMinutes', operator: 'lte', value: 45.5 },
					{ field: 'prepTimeMinutes', operator: 'gt', value: -5 },
					{ field: 'prepTimeMinutes', operator: 'gte', value: 0 },
					{ field: 'publishedAt', operator: 'lte', value: '2024-03-31T23:30:15.000Z' },
					{ field: 'publishedAt', operator: 'gte', value: '2024-03-01T00:00:00.000Z' },
					{ field: 'cookedOn', operator: 'gt', value: '2024-01-01' },
					{ field: 'bakedOn', operator: 'eq', value: new Date('2024-02-29T00:00:00Z') },
					{ field: 'calories', operator: 'lte', value: 500 }
				]
			}
		] satisfies ListParams[])('read back through listHref as %j', (params) => {
			expect(readListParams(at(href(params).replace('/admin/recipes', '')), ranged)).toEqual(
				params
			);
		});

		it('leave a clean URL alone, as the filter form sends it', () => {
			expect(
				rewrite(
					'?name.contains=piz&prepTimeMinutes.gte=10&prepTimeMinutes.lte=30' +
						'&publishedAt.gte=2024-03-01T00%3A00&bakedOn=2024-02-29'
				)
			).toBeUndefined();
			expect(rewrite('?cuisine=Italian&cuisine=Thai')).toBeUndefined();
		});

		it.each([
			[
				'a malformed number',
				'?prepTimeMinutes.gte=abc&prepTimeMinutes.lte=30',
				'/admin/recipes?prepTimeMinutes.lte=30'
			],
			['a malformed date', '?publishedAt.gte=2024-02-30T00:00&page=2', '/admin/recipes?page=2'],
			['contains on the narrowed text Field', '?cuisine.contains=Ital', '/admin/recipes'],
			[
				'a number in a longer form',
				'?prepTimeMinutes.gte=010.50',
				'/admin/recipes?prepTimeMinutes.gte=10.5'
			],
			[
				'numbers as a number input may send them',
				'?prepTimeMinutes.gte=.5&prepTimeMinutes.lte=1e3',
				'/admin/recipes?prepTimeMinutes.lte=1000&prepTimeMinutes.gte=0.5'
			],
			[
				'a datetime with zero seconds',
				'?publishedAt.lt=2024-03-01T10%3A30%3A00',
				'/admin/recipes?publishedAt.lt=2024-03-01T10%3A30'
			],
			[
				'blank range sides from a form',
				'?prepTimeMinutes.gte=&prepTimeMinutes.lte=30&name.contains=',
				'/admin/recipes?prepTimeMinutes.lte=30'
			]
		])('rewrite a URL with %s', (_, search, clean) => {
			expect(rewrite(search)).toBe(clean);
		});
	});
});
