import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { activeFilters, defineResource, field } from '@svelte-admin/core';

// A Resource with a filterable Field of every scalar Kind and value type.
const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true, filterable: true }),
		cuisine: field(z.string(), { filterable: ['eq', 'in'] }),
		difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
		prepTimeMinutes: field(z.number(), { label: 'Prep time (min)', filterable: true }),
		vegetarian: field(z.boolean(), { filterable: true }),
		publishedAt: field(z.iso.datetime(), { sortable: true, filterable: true }),
		servedOn: field(z.iso.date(), { filterable: true }).optional(),
		cookedOn: field(z.date(), { filterable: true }),
		internalNotes: field(z.string(), { hidden: true, filterable: ['eq'] })
	})
});

/** The label and href of each chip for a URL of the recipes list. */
const chips = (search: string) =>
	activeFilters(new URL(`http://admin.test/admin/recipes${search}`), recipes).map(
		({ label, href }) => ({ label, href })
	);

describe('the active filters', () => {
	it('shows an enum eq as the Field label and the value', () => {
		expect(chips('?difficulty=Easy')).toEqual([
			{ label: 'Difficulty: Easy', href: '/admin/recipes' }
		]);
	});

	it('is empty while no filter is on', () => {
		expect(chips('')).toEqual([]);
		expect(chips('?q=pasta&sort=name&page=2&difficulty=')).toEqual([]);
	});

	it.each([
		['difficulty=Easy&difficulty=Medium', 'Difficulty: Easy, Medium'],
		['name=Pizza', 'Name: Pizza'],
		['name.contains=piz', 'Name contains piz'],
		['cuisine=Thai&cuisine=Italian', 'Cuisine: Italian, Thai'],
		['vegetarian=true', 'Vegetarian: Yes'],
		['vegetarian=false', 'Vegetarian: No'],
		['prepTimeMinutes=15', 'Prep time (min): 15'],
		['prepTimeMinutes.lt=20', 'Prep time (min) < 20'],
		['prepTimeMinutes.lte=1500', 'Prep time (min) ≤ 1,500'],
		['prepTimeMinutes.gt=-5', 'Prep time (min) > -5'],
		['prepTimeMinutes.gte=45.5', 'Prep time (min) ≥ 45.5'],
		['servedOn=2024-03-01', 'Served on: Mar 1, 2024'],
		['servedOn.lt=2024-03-01', 'Served on < Mar 1, 2024'],
		['servedOn.lte=2024-03-01', 'Served on ≤ Mar 1, 2024'],
		['cookedOn=2024-12-31', 'Cooked on: Dec 31, 2024'],
		['cookedOn.gt=2024-12-31', 'Cooked on > Dec 31, 2024'],
		['cookedOn.gte=2024-12-31', 'Cooked on ≥ Dec 31, 2024'],
		['publishedAt=2024-03-01T10:30', 'Published at: Mar 1, 2024, 10:30 UTC'],
		['publishedAt.lt=2024-03-01T00:00', 'Published at < Mar 1, 2024'],
		['publishedAt.gte=2024-03-01T00:00', 'Published at ≥ Mar 1, 2024'],
		['publishedAt.lte=2024-03-01T23:30', 'Published at ≤ Mar 1, 2024, 23:30 UTC'],
		['publishedAt.gt=2024-03-01T09:05:30', 'Published at > Mar 1, 2024, 09:05:30 UTC']
	])('labels the filter %s as %j', (query, label) => {
		expect(chips(`?${query}`).map((chip) => chip.label)).toEqual([label]);
	});

	it('gives a filter on a hidden Field a chip too, by its label', () => {
		expect(chips('?internalNotes=draft')).toEqual([
			{ label: 'Internal notes: draft', href: '/admin/recipes' }
		]);
	});

	it('names the Field, operator and value of each filter, in the canonical order', () => {
		const url = new URL(
			'http://admin.test/admin/recipes?vegetarian=true&difficulty=Hard&difficulty=Easy&prepTimeMinutes.gte=10'
		);
		expect(
			activeFilters(url, recipes).map(({ field, operator, value }) => [field.key, operator, value])
		).toEqual([
			['difficulty', 'in', ['Easy', 'Hard']],
			['prepTimeMinutes', 'gte', 10],
			['vegetarian', 'eq', true]
		]);
	});

	describe('the href that removes a filter', () => {
		it('keeps the search, sort, page size and every other filter, at page 1', () => {
			expect(
				chips(
					'?page=3&perPage=10&sort=name&order=desc&q=pasta&difficulty=Easy&difficulty=Hard&prepTimeMinutes.gte=10&prepTimeMinutes.lte=30&vegetarian=true'
				).map((chip) => chip.href)
			).toEqual([
				'/admin/recipes?perPage=10&sort=name&order=desc&q=pasta&prepTimeMinutes.lte=30&prepTimeMinutes.gte=10&vegetarian=true',
				'/admin/recipes?perPage=10&sort=name&order=desc&q=pasta&difficulty=Easy&difficulty=Hard&prepTimeMinutes.gte=10&vegetarian=true',
				'/admin/recipes?perPage=10&sort=name&order=desc&q=pasta&difficulty=Easy&difficulty=Hard&prepTimeMinutes.lte=30&vegetarian=true',
				'/admin/recipes?perPage=10&sort=name&order=desc&q=pasta&difficulty=Easy&difficulty=Hard&prepTimeMinutes.lte=30&prepTimeMinutes.gte=10'
			]);
		});

		it('writes the other filters as the filter form sends them', () => {
			expect(
				chips('?vegetarian=true&publishedAt.gte=2024-03-01T10:30&cookedOn=2024-12-31').map(
					(chip) => chip.href
				)
			).toEqual([
				'/admin/recipes?publishedAt.gte=2024-03-01T10%3A30&cookedOn=2024-12-31',
				'/admin/recipes?vegetarian=true&cookedOn=2024-12-31',
				'/admin/recipes?vegetarian=true&publishedAt.gte=2024-03-01T10%3A30'
			]);
		});

		it("leaves out the Resource's own page size and default sort", () => {
			const posts = defineResource({
				name: 'posts',
				label: 'Posts',
				schema: z.object({
					id: field(z.number(), { sortable: true }),
					status: field(z.enum(['draft', 'published']), { filterable: true })
				}),
				defaultSort: { field: 'id', order: 'desc' },
				perPage: 20
			});
			const url = new URL('http://admin.test/admin/posts?page=2&status=draft');
			expect(activeFilters(url, posts).map((chip) => chip.href)).toEqual(['/admin/posts']);
		});

		it('drops what the URL holds that the list ignores', () => {
			expect(chips('?foo=1&vegetarian=true&prepTimeMinutes.gte=abc')).toEqual([
				{ label: 'Vegetarian: Yes', href: '/admin/recipes' }
			]);
		});
	});
});
