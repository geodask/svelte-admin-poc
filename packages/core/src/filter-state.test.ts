import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, field, readListParams, type Field } from '@svelte-admin/core';
import { filterState, type FilterControl } from './filter-state.ts';
import type { ReferencePicker } from './reference-picker.ts';

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

// A Resource with a filterable Field for every stock control, and two no control fits: a hidden
// Field, and a number Field that allows only `lt`.
const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	perPage: 10,
	defaultSort: { field: 'name', order: 'asc' },
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true, filterable: true }),
		cuisine: field(z.string(), { filterable: ['eq', 'in'] }),
		code: field(z.string(), { filterable: ['eq'] }),
		difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
		course: field(z.enum(['Starter', 'Main']), { filterable: ['eq'] }),
		vegetarian: field(z.boolean(), { filterable: true }),
		prepTimeMinutes: field(z.number(), { sortable: true, filterable: true }),
		servings: field(z.number(), { filterable: ['eq'] }),
		publishedAt: field(z.iso.datetime(), { filterable: true }),
		servedOn: field(z.iso.date(), { filterable: ['eq'] }),
		cookedOn: field(z.date(), { filterable: true }),
		authorId: field(z.number(), { label: 'Author', ref: () => users, filterable: true }),
		calories: field(z.number(), { filterable: ['lt'] }),
		internalNotes: field(z.string(), { hidden: true, filterable: ['eq'] })
	})
});

/** A filter control without its Field, each control keeping its own keys. */
type WithoutField<C> = C extends unknown ? Omit<C, 'field'> : never;

/** The list params a recipes list URL names. */
const paramsAt = (search: string) =>
	readListParams(new URL(`http://admin.test/admin/recipes${search}`), recipes);

/** A stand-in picker, which says which Reference and current id it was made for. */
const fakePicker = (field: Field, current: string) =>
	({ made: `${field.key}=${current}` }) as unknown as ReferencePicker;

/** The filter state of the recipes list at a URL. */
const stateAt = (search: string) => filterState(recipes, paramsAt(search), { picker: fakePicker });

/** The control of the Field `key`, without its Field, which is the Resource's own. */
function controlOf(search: string, key: string) {
	const control = stateAt(search).controls.find((candidate) => candidate.field.key === key);
	if (control === undefined) return undefined;
	const { field, ...rest } = control;
	expect(field).toBe(recipes.fields.find((candidate) => candidate.key === key));
	return rest;
}

/** What a filter form holds: its controls and its hidden inputs. */
function formData(entries: [string, string][]) {
	const data = new FormData();
	for (const [name, value] of entries) data.append(name, value);
	return data;
}

describe('the filter controls', () => {
	it.each<[string, string, string, WithoutField<FilterControl>]>([
		[
			'an enum Field that allows `in`: a checkbox per option, checked by an `in`',
			'difficulty',
			'?difficulty=Easy&difficulty=Hard',
			{
				type: 'checkboxes',
				name: 'difficulty',
				operators: ['eq', 'in'],
				options: [
					{ value: 'Easy', label: 'Easy', checked: true },
					{ value: 'Medium', label: 'Medium', checked: false },
					{ value: 'Hard', label: 'Hard', checked: true }
				]
			}
		],
		[
			'an enum Field that allows `in`: none checked with no filter',
			'difficulty',
			'',
			{
				type: 'checkboxes',
				name: 'difficulty',
				operators: ['eq', 'in'],
				options: [
					{ value: 'Easy', label: 'Easy', checked: false },
					{ value: 'Medium', label: 'Medium', checked: false },
					{ value: 'Hard', label: 'Hard', checked: false }
				]
			}
		],
		[
			'an enum Field that allows only `eq`: a radio button per option, after "Any"',
			'course',
			'?course=Main',
			{
				type: 'radio',
				name: 'course',
				operators: ['eq'],
				options: [
					{ value: '', label: 'Any', checked: false },
					{ value: 'Starter', label: 'Starter', checked: false },
					{ value: 'Main', label: 'Main', checked: true }
				]
			}
		],
		[
			'a boolean Field: Any, Yes and No, with Any checked while it filters nothing',
			'vegetarian',
			'',
			{
				type: 'radio',
				name: 'vegetarian',
				operators: ['eq'],
				options: [
					{ value: '', label: 'Any', checked: true },
					{ value: 'true', label: 'Yes', checked: false },
					{ value: 'false', label: 'No', checked: false }
				]
			}
		],
		[
			'a boolean Field: No checked by `false`',
			'vegetarian',
			'?vegetarian=false',
			{
				type: 'radio',
				name: 'vegetarian',
				operators: ['eq'],
				options: [
					{ value: '', label: 'Any', checked: false },
					{ value: 'true', label: 'Yes', checked: false },
					{ value: 'false', label: 'No', checked: true }
				]
			}
		],
		[
			'a text Field that allows `contains`: one text box, named with the operator',
			'name',
			'?name.contains=piz',
			{
				type: 'input',
				input: 'text',
				operators: ['contains'],
				values: [{ name: 'name.contains', value: 'piz' }]
			}
		],
		[
			'a text Field that allows only `eq`: one exact text box',
			'code',
			'?code=AB-1',
			{
				type: 'input',
				input: 'text',
				operators: ['eq'],
				values: [{ name: 'code', value: 'AB-1' }]
			}
		],
		[
			'a text Field that allows `eq` and `in`: one empty exact box with no filter',
			'cuisine',
			'',
			{
				type: 'input',
				input: 'text',
				operators: ['eq', 'in'],
				values: [{ name: 'cuisine', value: '' }]
			}
		],
		[
			'a text Field that allows `eq` and `in`: one box for an `eq`',
			'cuisine',
			'?cuisine=Thai',
			{
				type: 'input',
				input: 'text',
				operators: ['eq', 'in'],
				values: [{ name: 'cuisine', value: 'Thai' }]
			}
		],
		[
			'a text Field that allows `eq` and `in`: a box per value of an `in`, and no empty one',
			'cuisine',
			'?cuisine=Thai&cuisine=Italian',
			{
				type: 'input',
				input: 'text',
				operators: ['eq', 'in'],
				values: [
					{ name: 'cuisine', value: 'Italian' },
					{ name: 'cuisine', value: 'Thai' }
				]
			}
		],
		[
			'a number Field that allows a range: a from and a to input',
			'prepTimeMinutes',
			'?prepTimeMinutes.gte=10&prepTimeMinutes.lte=1e3',
			{
				type: 'range',
				input: 'number',
				operators: ['lte', 'gte'],
				from: { name: 'prepTimeMinutes.gte', value: '10' },
				to: { name: 'prepTimeMinutes.lte', value: '1000' }
			}
		],
		[
			'a number Field that allows a range: either side may be empty',
			'prepTimeMinutes',
			'?prepTimeMinutes.lte=30',
			{
				type: 'range',
				input: 'number',
				operators: ['lte', 'gte'],
				from: { name: 'prepTimeMinutes.gte', value: '' },
				to: { name: 'prepTimeMinutes.lte', value: '30' }
			}
		],
		[
			'a number Field that allows only `eq`: one number input',
			'servings',
			'?servings=4',
			{
				type: 'input',
				input: 'number',
				operators: ['eq'],
				values: [{ name: 'servings', value: '4' }]
			}
		],
		[
			'a datetime Field: a range of `datetime-local` inputs, written in UTC to the minute',
			'publishedAt',
			'?publishedAt.gte=2024-03-01T10:30:00',
			{
				type: 'range',
				input: 'datetime',
				operators: ['lte', 'gte'],
				from: { name: 'publishedAt.gte', value: '2024-03-01T10:30' },
				to: { name: 'publishedAt.lte', value: '' }
			}
		],
		[
			'an ISO date Field that allows only `eq`: one date input',
			'servedOn',
			'?servedOn=2024-03-01',
			{
				type: 'input',
				input: 'date',
				operators: ['eq'],
				values: [{ name: 'servedOn', value: '2024-03-01' }]
			}
		],
		[
			'a `Date` Field: a range of date inputs, each its UTC day',
			'cookedOn',
			'?cookedOn.gte=2024-12-01&cookedOn.lte=2024-12-31',
			{
				type: 'range',
				input: 'date',
				operators: ['lte', 'gte'],
				from: { name: 'cookedOn.gte', value: '2024-12-01' },
				to: { name: 'cookedOn.lte', value: '2024-12-31' }
			}
		]
	])('offers %s', (_name, key, search, control) => {
		expect(controlOf(search, key)).toEqual(control);
	});

	it('offers a Reference a choice of the target’s records, with the picker the caller gives', () => {
		expect(controlOf('?authorId=3', 'authorId')).toEqual({
			type: 'reference',
			operators: ['eq'],
			current: { name: 'authorId', value: '3' },
			emptyLabel: 'Any',
			picker: { made: 'authorId=3' }
		});
		expect(controlOf('', 'authorId')).toMatchObject({
			current: { name: 'authorId', value: '' },
			picker: { made: 'authorId=' }
		});
	});

	it('never shows an exact text box beside an `in`: the boxes hold its values', () => {
		const control = controlOf('?cuisine=Thai&cuisine=Italian', 'cuisine');
		expect(control?.type === 'input' && control.values.map(({ value }) => value)).toEqual([
			'Italian',
			'Thai'
		]);
	});

	it('offers one control per filterable Field a stock control fits, in schema order', () => {
		expect(stateAt('').controls.map((control) => control.field.key)).toEqual([
			'name',
			'cuisine',
			'code',
			'difficulty',
			'course',
			'vegetarian',
			'prepTimeMinutes',
			'servings',
			'publishedAt',
			'servedOn',
			'cookedOn',
			'authorId'
		]);
	});

	it('offers no control for a hidden Field, or for one whose operators no control sends', () => {
		const keys = stateAt('?internalNotes=draft&calories.lt=500').controls.map(
			(control) => control.field.key
		);
		expect(keys).not.toContain('internalNotes');
		expect(keys).not.toContain('calories');
	});
});

describe('the kept inputs', () => {
	it('of the filter form keep the search, a sort and a page size off their defaults, never the page', () => {
		expect(
			stateAt('?page=3&perPage=50&sort=prepTimeMinutes&order=desc&q=pasta').hidden.filterForm
		).toEqual([
			['perPage', '50'],
			['sort', 'prepTimeMinutes'],
			['order', 'desc'],
			['q', 'pasta']
		]);
		expect(stateAt('?page=3').hidden.filterForm).toEqual([]);
	});

	it('of the filter form keep each filter no control sends, and no other', () => {
		expect(
			stateAt(
				'?internalNotes=draft&calories.lt=500&name.contains=piz&difficulty=Easy&prepTimeMinutes.gt=5'
			).hidden.filterForm
		).toEqual([
			['prepTimeMinutes.gt', '5'],
			['calories.lt', '500'],
			['internalNotes', 'draft']
		]);
	});

	it('of the filter form keep a text `eq` on a Field whose control sends `contains`', () => {
		expect(stateAt('?name=Pizza').hidden.filterForm).toEqual([['name', 'Pizza']]);
	});

	it('of the search form keep a sort, a page size and every filter, but not the search or the page', () => {
		expect(
			stateAt('?page=2&perPage=50&sort=prepTimeMinutes&q=pasta&difficulty=Easy&internalNotes=draft')
				.hidden.searchForm
		).toEqual([
			['perPage', '50'],
			['sort', 'prepTimeMinutes'],
			['difficulty', 'Easy'],
			['internalNotes', 'draft']
		]);
	});

	it('write a filter value as its input sends it', () => {
		expect(stateAt('?q=x&publishedAt.gt=2024-03-01T10:30:00').hidden.searchForm).toEqual([
			['publishedAt.gt', '2024-03-01T10:30']
		]);
	});
});

describe('the next params', () => {
	it('are what the filter form holds, at page 1', () => {
		const next = stateAt('?page=3').nextParams(
			formData([
				['perPage', '50'],
				['q', 'pasta'],
				['difficulty', 'Easy'],
				['difficulty', 'Hard'],
				['prepTimeMinutes.gte', '10'],
				['authorId', '3']
			])
		);

		expect(next).toEqual({
			page: 1,
			perPage: 50,
			search: 'pasta',
			sort: { field: 'name', order: 'asc' },
			filters: [
				{ field: 'difficulty', operator: 'in', value: ['Easy', 'Hard'] },
				{ field: 'prepTimeMinutes', operator: 'gte', value: 10 },
				{ field: 'authorId', operator: 'eq', value: 3 }
			]
		});
	});

	it('leave out the empty controls', () => {
		const next = stateAt('').nextParams(
			formData([
				['name.contains', ''],
				['cuisine', ''],
				['cuisine', 'Thai'],
				['vegetarian', ''],
				['prepTimeMinutes.gte', ''],
				['prepTimeMinutes.lte', '30'],
				['publishedAt.gte', ''],
				['authorId', '']
			])
		);

		expect(next).toEqual({
			page: 1,
			perPage: 10,
			sort: { field: 'name', order: 'asc' },
			filters: [
				{ field: 'cuisine', operator: 'eq', value: 'Thai' },
				{ field: 'prepTimeMinutes', operator: 'lte', value: 30 }
			]
		});
	});

	it('are unfiltered when every control is empty', () => {
		const next = stateAt('?difficulty=Easy').nextParams(
			formData([
				['vegetarian', ''],
				['cuisine', '']
			])
		);

		expect(next).toEqual({ page: 1, perPage: 10, sort: { field: 'name', order: 'asc' } });
	});

	it('read each value through the Field input codec, dropping one that is no value', () => {
		const next = stateAt('').nextParams(
			formData([
				['publishedAt.gte', '2024-02-30T10:00'],
				['publishedAt.lte', '2024-03-01T10:30'],
				['servings', ' 4'],
				['authorId', '03']
			])
		);

		expect(next.filters).toEqual([
			{ field: 'publishedAt', operator: 'lte', value: '2024-03-01T10:30:00.000Z' }
		]);
	});

	it('keep the filters the form keeps as hidden inputs', () => {
		const state = stateAt('?internalNotes=draft&calories.lt=500&difficulty=Easy');

		expect(state.nextParams(formData(state.hidden.filterForm)).filters).toEqual([
			{ field: 'calories', operator: 'lt', value: 500 },
			{ field: 'internalNotes', operator: 'eq', value: 'draft' }
		]);
	});
});
