import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	createPath,
	defineResource,
	editPath,
	idFromParam,
	idPathSegment,
	recordPath
} from '@svelte-admin/core';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.string(), email: z.string() })
});

describe('a route param as a typed id', () => {
	it('is a number for a Resource with number ids', () => {
		expect(idFromParam(recipes, '1')).toBe(1);
		expect(idFromParam(recipes, '1042')).toBe(1042);
	});

	it('is the param itself for a Resource with string ids', () => {
		expect(idFromParam(users, '1')).toBe('1');
		expect(idFromParam(users, 'ada-lovelace')).toBe('ada-lovelace');
		expect(idFromParam(users, '../posts/1')).toBe('../posts/1');
	});

	it.each(['abc', '1abc', '', ' 1', '1 ', '01', '1.0', '1e3', '0x10', 'Infinity', 'NaN'])(
		'is no id for the number param %j',
		(param) => {
			expect(idFromParam(recipes, param)).toBeUndefined();
		}
	);

	it('is no id when the id schema rejects it', () => {
		const orders = defineResource({
			name: 'orders',
			label: 'Orders',
			schema: z.object({ id: z.int().positive() })
		});
		const slugs = defineResource({
			name: 'slugs',
			label: 'Slugs',
			schema: z.object({ id: z.string().regex(/^[a-z-]+$/) })
		});

		expect(idFromParam(orders, '7')).toBe(7);
		expect(idFromParam(orders, '-7')).toBeUndefined();
		expect(idFromParam(orders, '1.5')).toBeUndefined();
		expect(idFromParam(slugs, 'weeknight-dinners')).toBe('weeknight-dinners');
		expect(idFromParam(slugs, 'Weeknight')).toBeUndefined();
	});

	it.each(['', '.', '..'])('is no id for %j, which cannot be one path segment', (param) => {
		expect(idFromParam(users, param)).toBeUndefined();
	});

	it('is no id for "new", the create View\'s segment, even for string ids', () => {
		expect(idFromParam(users, 'new')).toBeUndefined();
		expect(idFromParam(users, 'news')).toBe('news');
	});
});

describe('an id as one URL path segment', () => {
	it.each([
		[1, '1'],
		['ada', 'ada'],
		['../users/1', '..%2Fusers%2F1'],
		['a/b', 'a%2Fb'],
		['a..b', 'a..b'],
		['what?', 'what%3F'],
		['#1', '%231'],
		['100%', '100%25'],
		['two words', 'two%20words']
	])('writes %j as %j', (id, segment) => {
		expect(idPathSegment(id)).toBe(segment);
	});

	it('round-trips through a route param', () => {
		for (const id of [1, 1042]) {
			expect(idFromParam(recipes, decodeURIComponent(idPathSegment(id)))).toBe(id);
		}
		for (const id of ['../users/1', 'what?#x', '100%']) {
			expect(idFromParam(users, decodeURIComponent(idPathSegment(id)))).toBe(id);
		}
	});

	it.each(['', '.', '..'])('refuses %j, which a URL would not keep as one segment', (id) => {
		expect(() => idPathSegment(id)).toThrow(/path segment/);
	});
});

describe("a record's hrefs under a prefix", () => {
	it.each([
		['/admin/recipes', '/admin/recipes/12', '/admin/recipes/new', '/admin/recipes/12/edit'],
		[
			'/shop/admin/recipes',
			'/shop/admin/recipes/12',
			'/shop/admin/recipes/new',
			'/shop/admin/recipes/12/edit'
		]
	])('under %j are the detail, create and edit Views', (list, detail, create, edit) => {
		expect(recordPath(list, 12)).toBe(detail);
		expect(createPath(list)).toBe(create);
		expect(editPath(list, 12)).toBe(edit);
	});
});
