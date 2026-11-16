import { describe, expect, it } from 'vitest';
import { encodeListParams, listHref, listUrlRewrite, readListParams } from '@svelte-admin/core';

// Only whether a Resource is searchable matters to the list URL.
const searchable = { searchable: true };
const notSearchable = { searchable: false };

const read = (search: string, resource = notSearchable) =>
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
		const urlDefaults = { page: 1, perPage: 25 };
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
		const rewrite = (search: string, resource = notSearchable) =>
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
});
