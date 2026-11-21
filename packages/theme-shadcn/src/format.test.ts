import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, field, type FilterOperator, type FilterValue } from '@svelte-admin/core';
import type { FilterChip } from '@svelte-admin/core/views';
import { formatFilterChip } from './format.ts';

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

// A Resource with a filterable Field of every scalar Kind and value type, and a Reference.
const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { filterable: true }),
		cuisine: field(z.string(), { filterable: ['eq', 'in'] }),
		difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
		prepTimeMinutes: field(z.number(), { label: 'Prep time (min)', filterable: true }),
		vegetarian: field(z.boolean(), { filterable: true }),
		publishedAt: field(z.iso.datetime(), { filterable: true }),
		servedOn: field(z.iso.date(), { filterable: true }).optional(),
		cookedOn: field(z.date(), { filterable: true }),
		userId: field(z.number(), { label: 'Author', ref: () => users, filterable: true })
	})
});

/** A chip on the recipes Field `key`, with values as the list params hold them. */
function chip(
	key: string,
	operator: FilterOperator,
	values: (FilterValue | { value: FilterValue; title: string })[]
): FilterChip {
	return {
		field: recipes.fields.find((candidate) => candidate.key === key)!,
		operator,
		values: values.map((value) =>
			typeof value === 'object' && !(value instanceof Date) ? value : { value }
		),
		href: '/admin/recipes'
	};
}

describe("a filter chip's text", () => {
	it.each<[FilterChip, string]>([
		[chip('difficulty', 'eq', ['Easy']), 'Difficulty: Easy'],
		[chip('difficulty', 'in', ['Easy', 'Medium']), 'Difficulty: Easy, Medium'],
		[chip('name', 'eq', ['Pizza']), 'Name: Pizza'],
		[chip('name', 'contains', ['piz']), 'Name contains piz'],
		[chip('cuisine', 'in', ['Italian', 'Thai']), 'Cuisine: Italian, Thai'],
		[chip('vegetarian', 'eq', [true]), 'Vegetarian: Yes'],
		[chip('vegetarian', 'eq', [false]), 'Vegetarian: No'],
		[chip('prepTimeMinutes', 'eq', [15]), 'Prep time (min): 15'],
		[chip('prepTimeMinutes', 'lt', [20]), 'Prep time (min) < 20'],
		[chip('prepTimeMinutes', 'lte', [1500]), 'Prep time (min) ≤ 1,500'],
		[chip('prepTimeMinutes', 'gt', [-5]), 'Prep time (min) > -5'],
		[chip('prepTimeMinutes', 'gte', [45.5]), 'Prep time (min) ≥ 45.5'],
		[chip('servedOn', 'eq', ['2024-03-01']), 'Served on: Mar 1, 2024'],
		[chip('servedOn', 'lt', ['2024-03-01']), 'Served on < Mar 1, 2024'],
		[chip('cookedOn', 'gte', [new Date('2024-12-31')]), 'Cooked on ≥ Dec 31, 2024'],
		[
			chip('publishedAt', 'eq', ['2024-03-01T10:30:00.000Z']),
			'Published at: Mar 1, 2024, 10:30 UTC'
		],
		[chip('publishedAt', 'lt', ['2024-03-01T00:00:00.000Z']), 'Published at < Mar 1, 2024'],
		[
			chip('publishedAt', 'lte', ['2024-03-01T23:30:00.000Z']),
			'Published at ≤ Mar 1, 2024, 23:30 UTC'
		],
		[
			chip('publishedAt', 'gt', ['2024-03-01T09:05:30.000Z']),
			'Published at > Mar 1, 2024, 09:05:30 UTC'
		],
		[
			chip('publishedAt', 'gte', ['2024-03-01T09:05:30.250Z']),
			'Published at ≥ Mar 1, 2024, 09:05:30.250 UTC'
		]
	])('writes %o as %j', (filter, text) => {
		expect(formatFilterChip(filter)).toBe(text);
	});

	it("names a Reference by its record's Record title", () => {
		expect(formatFilterChip(chip('userId', 'eq', [{ value: 3, title: 'Ada Lovelace' }]))).toBe(
			'Author: Ada Lovelace'
		);
	});

	it('names a Reference with no title by its id as the URL writes it', () => {
		expect(formatFilterChip(chip('userId', 'eq', [1234]))).toBe('Author: 1234');
	});
});
