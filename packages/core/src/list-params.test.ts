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

	describe('for a Resource with filterable Fields', () => {
		const filterable = defineResource({
			name: 'recipes',
			label: 'Recipes',
			searchable: true,
			schema: z.object({
				id: z.number(),
				// A refinement that a filter value isn't held to.
				name: field(z.string().min(5), { filterable: ['eq'] }),
				difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
				course: field(z.enum(['main', 'dessert']), { filterable: ['eq'] }),
				vegetarian: field(z.boolean(), { filterable: true }).optional(),
				secret: field(z.boolean(), { hidden: true, filterable: true }),
				cuisine: z.string()
			})
		});
		const schema = listParamsSchema(filterable);
		const withFilters = (filters: unknown) => schema.safeParse({ page: 1, perPage: 25, filters });
		const accepted = (filters: unknown) => withFilters(filters).success;

		it('accepts filters on the declared Fields, with their operators and values', () => {
			expect(
				withFilters([
					{ field: 'difficulty', operator: 'in', value: ['Easy', 'Hard'] },
					{ field: 'vegetarian', operator: 'eq', value: false }
				])
			).toEqual({
				success: true,
				data: {
					page: 1,
					perPage: 25,
					filters: [
						{ field: 'difficulty', operator: 'in', value: ['Easy', 'Hard'] },
						{ field: 'vegetarian', operator: 'eq', value: false }
					]
				}
			});
			expect(accepted([{ field: 'difficulty', operator: 'eq', value: 'Medium' }])).toBe(true);
			expect(accepted([{ field: 'course', operator: 'eq', value: 'main' }])).toBe(true);
			expect(accepted([{ field: 'secret', operator: 'eq', value: true }])).toBe(true);
		});

		it('checks a value against the base type only, not its refinements', () => {
			expect(accepted([{ field: 'name', operator: 'eq', value: 'Pho' }])).toBe(true);
		});

		it('accepts no filters', () => {
			expect(schema.parse({ page: 1, perPage: 25 })).toEqual({ page: 1, perPage: 25 });
		});

		it('gives the Provider the filters in schema order, then operator order, values in enum order', () => {
			expect(
				schema.parse({
					page: 1,
					perPage: 25,
					filters: [
						{ field: 'vegetarian', operator: 'eq', value: true },
						{ field: 'difficulty', operator: 'in', value: ['Hard', 'Easy'] },
						{ field: 'difficulty', operator: 'eq', value: 'Medium' }
					]
				}).filters
			).toEqual([
				{ field: 'difficulty', operator: 'eq', value: 'Medium' },
				{ field: 'difficulty', operator: 'in', value: ['Easy', 'Hard'] },
				{ field: 'vegetarian', operator: 'eq', value: true }
			]);
		});

		it.each([
			['an undeclared Field', [{ field: 'cuisine', operator: 'eq', value: 'Thai' }]],
			['a Field it does not have', [{ field: 'rating', operator: 'eq', value: 5 }]],
			[
				'an operator the Kind does not have',
				[{ field: 'vegetarian', operator: 'in', value: [true, false] }]
			],
			[
				'an operator the Field does not allow',
				[{ field: 'course', operator: 'in', value: ['main', 'dessert'] }]
			],
			[
				'an operator for another Kind',
				[{ field: 'difficulty', operator: 'contains', value: 'Ea' }]
			],
			['an unknown operator', [{ field: 'difficulty', operator: 'ne', value: 'Easy' }]],
			[
				'a value that is not an enum member',
				[{ field: 'difficulty', operator: 'eq', value: 'Spicy' }]
			],
			['a boolean written as text', [{ field: 'vegetarian', operator: 'eq', value: 'true' }]],
			['a single value for in', [{ field: 'difficulty', operator: 'in', value: 'Easy' }]],
			['an array for eq', [{ field: 'difficulty', operator: 'eq', value: ['Easy'] }]],
			['an in of one value', [{ field: 'difficulty', operator: 'in', value: ['Easy'] }]],
			[
				'an in with a repeated value',
				[{ field: 'difficulty', operator: 'in', value: ['Easy', 'Easy'] }]
			],
			['an empty in', [{ field: 'difficulty', operator: 'in', value: [] }]],
			['a missing value', [{ field: 'vegetarian', operator: 'eq' }]],
			['an extra key', [{ field: 'vegetarian', operator: 'eq', value: true, not: true }]],
			[
				'the same Field and operator twice',
				[
					{ field: 'vegetarian', operator: 'eq', value: true },
					{ field: 'vegetarian', operator: 'eq', value: false }
				]
			],
			['an empty list', []],
			['an object instead of a list', { vegetarian: true }]
		])('rejects %s', (_, filters) => {
			expect(accepted(filters)).toBe(false);
		});

		it('accepts an in of 2 to 100 values, and rejects 101', () => {
			const ints = defineResource({
				name: 'things',
				label: 'Things',
				schema: z.object({
					id: z.number(),
					code: field(z.enum(Array.from({ length: 101 }, (_, i) => `c${i}`)), {
						filterable: true
					})
				})
			});
			const values = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);
			const parse = (n: number) =>
				listParamsSchema(ints).safeParse({
					page: 1,
					perPage: 25,
					filters: [{ field: 'code', operator: 'in', value: values(n) }]
				}).success;
			expect(parse(2)).toBe(true);
			expect(parse(100)).toBe(true);
			expect(parse(101)).toBe(false);
		});
	});

	describe('for a Resource with text, number and date filters', () => {
		const ranged = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				// Refinements that a filter value isn't held to.
				name: field(z.string().min(5), { filterable: true }),
				cuisine: field(z.string(), { filterable: ['eq', 'in'] }),
				prepTimeMinutes: field(z.int().min(1), { filterable: true }),
				difficulty: field(z.enum(['Easy', 'Hard']), { filterable: true }),
				publishedAt: field(z.iso.datetime(), { filterable: true }),
				cookedOn: field(z.iso.date(), { filterable: true }),
				bakedOn: field(z.date(), { filterable: ['gte', 'lte'] })
			})
		});
		const schema = listParamsSchema(ranged);
		const accepted = (filters: unknown) =>
			schema.safeParse({ page: 1, perPage: 25, filters }).success;

		it('accepts a short contains value on a Field with a .min() refinement', () => {
			expect(accepted([{ field: 'name', operator: 'contains', value: 'piz' }])).toBe(true);
		});

		it('accepts text eq and in on a narrowed text Field, as for an enum', () => {
			expect(accepted([{ field: 'cuisine', operator: 'eq', value: 'It' }])).toBe(true);
			expect(accepted([{ field: 'cuisine', operator: 'in', value: ['Italian', 'Thai'] }])).toBe(
				true
			);
		});

		it('accepts every range operator on a number, with any finite number', () => {
			for (const operator of ['eq', 'lt', 'lte', 'gt', 'gte']) {
				expect(accepted([{ field: 'prepTimeMinutes', operator, value: -2.5 }])).toBe(true);
			}
		});

		it('accepts dates in the Field type: ISO strings, or a Date', () => {
			expect(
				accepted([
					{ field: 'publishedAt', operator: 'gte', value: '2024-03-01T00:00:00.000Z' },
					{ field: 'cookedOn', operator: 'lt', value: '2024-03-01' },
					{ field: 'bakedOn', operator: 'lte', value: new Date('2024-03-01T00:00:00Z') }
				])
			).toBe(true);
		});

		it.each([
			[
				'contains on a Field narrowed to eq and in',
				{ field: 'cuisine', operator: 'contains', value: 'Ital' }
			],
			['a range on an enum', { field: 'difficulty', operator: 'gte', value: 'Easy' }],
			['a range on text', { field: 'name', operator: 'lt', value: 'M' }],
			['contains on a number', { field: 'prepTimeMinutes', operator: 'contains', value: 1 }],
			['eq on a date narrowed to a range', { field: 'bakedOn', operator: 'eq', value: new Date() }],
			['an infinite number', { field: 'prepTimeMinutes', operator: 'gte', value: Infinity }],
			['a number that is NaN', { field: 'prepTimeMinutes', operator: 'lt', value: Number.NaN }],
			['a number written as text', { field: 'prepTimeMinutes', operator: 'gte', value: '10' }],
			[
				'a datetime as the input writes it',
				{ field: 'publishedAt', operator: 'gte', value: '2024-03-01T00:00' }
			],
			['a datetime as a Date', { field: 'publishedAt', operator: 'gte', value: new Date() }],
			['an ISO date as a datetime', { field: 'publishedAt', operator: 'lt', value: '2024-03-01' }],
			['a Date for an ISO date', { field: 'cookedOn', operator: 'lt', value: new Date() }],
			['an ISO string for a Date', { field: 'bakedOn', operator: 'gte', value: '2024-03-01' }],
			['an invalid Date', { field: 'bakedOn', operator: 'gte', value: new Date('nope') }],
			['text that is not a string', { field: 'name', operator: 'contains', value: 5 }]
		])('rejects %s', (_, filter) => {
			expect(accepted([filter])).toBe(false);
		});
	});

	describe('for a Resource with no filterable Field', () => {
		it('rejects any filters as an undeclared key', () => {
			expect(accepts({ page: 1, perPage: 25, filters: [] })).toBe(false);
			expect(
				accepts({ page: 1, perPage: 25, filters: [{ field: 'title', operator: 'eq', value: 'x' }] })
			).toBe(false);
		});
	});
});
