import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, field, recordTitle } from '@svelte-admin/core';

describe('the Record title, by the default rule', () => {
	it('is the `name` Field', () => {
		const recipes = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({ id: z.number(), title: z.string(), name: z.string() })
		});

		expect(recordTitle(recipes, { id: 1, title: 'Pizza night', name: 'Margherita Pizza' })).toBe(
			'Margherita Pizza'
		);
	});

	it('is the `title` Field when there is no `name` Field', () => {
		const posts = defineResource({
			name: 'posts',
			label: 'Posts',
			schema: z.object({ id: z.number(), title: z.string() })
		});

		expect(recordTitle(posts, { id: 7, title: 'Ten tips for meal prep' })).toBe(
			'Ten tips for meal prep'
		);
	});

	it('is the id when there is neither', () => {
		const tags = defineResource({
			name: 'tags',
			label: 'Tags',
			schema: z.object({ id: z.string(), color: z.string() })
		});

		expect(recordTitle(tags, { id: 'weeknight', color: 'green' })).toBe('weeknight');
	});

	it('is a number id written as digits', () => {
		const orders = defineResource({
			name: 'orders',
			label: 'Orders',
			schema: z.object({ id: z.number() })
		});

		expect(recordTitle(orders, { id: 1042 })).toBe('1042');
	});

	it('falls back past an empty `name` to `title`, then to the id', () => {
		const pages = defineResource({
			name: 'pages',
			label: 'Pages',
			schema: z.object({
				id: z.number(),
				name: z.string().optional(),
				title: z.string().nullable()
			})
		});

		expect(recordTitle(pages, { id: 3, name: '', title: 'About us' })).toBe('About us');
		expect(recordTitle(pages, { id: 3, title: null })).toBe('3');
	});

	it('never uses a hidden Field, so the heading cannot show it', () => {
		const accounts = defineResource({
			name: 'accounts',
			label: 'Accounts',
			schema: z.object({ id: z.number(), name: field(z.string(), { hidden: true }) })
		});

		expect(recordTitle(accounts, { id: 5, name: 'Secret' })).toBe('5');
	});
});
