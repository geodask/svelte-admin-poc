import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, field, listParamsSchema } from '@svelte-admin/core';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() }),
	searchable: true
});

const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({ id: z.number(), title: z.string() })
});

describe('the getList input schema', () => {
	const accepts = (input: unknown) => listParamsSchema(posts).safeParse(input).success;

	it('accepts a page and a page size', () => {
		expect(listParamsSchema(posts).parse({ page: 3, perPage: 25 })).toEqual({
			page: 3,
			perPage: 25
		});
	});

	it('accepts a page size up to the cap of 100', () => {
		expect(accepts({ page: 1, perPage: 100 })).toBe(true);
		expect(accepts({ page: 1, perPage: 101 })).toBe(false);
	});

	it('rejects a page or page size below 1', () => {
		expect(accepts({ page: 0, perPage: 25 })).toBe(false);
		expect(accepts({ page: 1, perPage: 0 })).toBe(false);
	});

	it('rejects fractions and strings, so params are never coerced', () => {
		expect(accepts({ page: 1.5, perPage: 25 })).toBe(false);
		expect(accepts({ page: '1', perPage: 25 })).toBe(false);
	});

	it('rejects a missing param', () => {
		expect(accepts({ page: 1 })).toBe(false);
	});

	it('rejects any undeclared key, so the Provider never sees one', () => {
		expect(accepts({ page: 1, perPage: 25, limit: 100000 })).toBe(false);
	});

	describe('for a searchable Resource', () => {
		const schema = listParamsSchema(recipes);

		it('accepts a search', () => {
			expect(schema.parse({ page: 1, perPage: 25, search: 'pasta' })).toEqual({
				page: 1,
				perPage: 25,
				search: 'pasta'
			});
		});

		it('accepts no search', () => {
			expect(schema.parse({ page: 1, perPage: 25 })).toEqual({ page: 1, perPage: 25 });
		});

		it.each(['', '   '])(
			'rejects the blank search %j, which the list View leaves out instead',
			(search) => {
				expect(schema.safeParse({ page: 1, perPage: 25, search }).success).toBe(false);
			}
		);

		it('gives the Provider a search without the spaces around it', () => {
			expect(schema.parse({ page: 1, perPage: 25, search: '  chicken tacos ' })).toEqual({
				page: 1,
				perPage: 25,
				search: 'chicken tacos'
			});
		});

		it('rejects a search that is not a string', () => {
			expect(schema.safeParse({ page: 1, perPage: 25, search: 42 }).success).toBe(false);
		});

		it('still rejects any other undeclared key', () => {
			expect(schema.safeParse({ page: 1, perPage: 25, q: 'pasta' }).success).toBe(false);
		});
	});

	describe('for a Resource that is not searchable', () => {
		it('rejects a search as an undeclared key', () => {
			expect(accepts({ page: 1, perPage: 25, search: 'pasta' })).toBe(false);
		});
	});

	describe('for a Resource with sortable Fields', () => {
		const sortable = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: field(z.number(), { sortable: true }),
				name: field(z.string(), { sortable: true }),
				cuisine: z.string(),
				calories: field(z.number(), { sortable: true }).optional(),
				secret: field(z.string(), { hidden: true, sortable: true })
			})
		});
		const schema = listParamsSchema(sortable);
		const withSort = (sort: unknown) => schema.safeParse({ page: 1, perPage: 25, sort });

		it.each(['id', 'name', 'calories', 'secret'])(
			'accepts a sort on the sortable Field %s, either way',
			(key) => {
				for (const order of ['asc', 'desc']) {
					expect(withSort({ field: key, order })).toEqual({
						success: true,
						data: { page: 1, perPage: 25, sort: { field: key, order } }
					});
				}
			}
		);

		it('accepts no sort', () => {
			expect(schema.parse({ page: 1, perPage: 25 })).toEqual({ page: 1, perPage: 25 });
		});

		it.each([
			['a Field that is not sortable', { field: 'cuisine', order: 'asc' }],
			['a Field it does not have', { field: 'rating', order: 'asc' }],
			['an unknown order', { field: 'name', order: 'up' }],
			['a missing order', { field: 'name' }],
			['a missing Field', { order: 'asc' }],
			['an extra key', { field: 'name', order: 'asc', nulls: 'last' }],
			['a bare Field name', 'name'],
			['an empty sort', {}],
			['a list of sorts', [{ field: 'name', order: 'asc' }]]
		])('rejects a sort on %s', (_, sort) => {
			expect(withSort(sort).success).toBe(false);
		});
	});

	describe('for a Resource with no sortable Field', () => {
		it('rejects any sort as an undeclared key', () => {
			expect(accepts({ page: 1, perPage: 25, sort: { field: 'title', order: 'asc' } })).toBe(false);
		});
	});
});
