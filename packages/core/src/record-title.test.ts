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

describe('the Record title, by the `recordTitle` setting', () => {
	const schema = z.object({
		id: z.number(),
		name: z.string(),
		sku: z.string(),
		size: z.string().optional()
	});

	it('is the value of the Field a key names, ahead of `name`', () => {
		const products = defineResource({
			name: 'products',
			label: 'Products',
			schema,
			recordTitle: 'sku'
		});

		expect(recordTitle(products, { id: 1, name: 'Linen shirt', sku: 'LS-042' })).toBe('LS-042');
	});

	it("is a number Field's value written as digits", () => {
		const invoices = defineResource({
			name: 'invoices',
			label: 'Invoices',
			schema: z.object({ id: z.string(), number: z.number() }),
			recordTitle: 'number'
		});

		expect(recordTitle(invoices, { id: 'inv_9', number: 2026001 })).toBe('2026001');
	});

	it("is the id when the key's Field is empty, so a record is never named by nothing", () => {
		const products = defineResource({
			name: 'products',
			label: 'Products',
			schema,
			recordTitle: 'size'
		});

		expect(recordTitle(products, { id: 4, name: 'Linen shirt', sku: 'LS-042' })).toBe('4');
		expect(recordTitle(products, { id: 4, name: 'Linen shirt', sku: 'LS-042', size: '' })).toBe(
			'4'
		);
	});

	it("is the function's result", () => {
		const products = defineResource({
			name: 'products',
			label: 'Products',
			schema,
			recordTitle: (product) => `${product.name} (${product.sku})`
		});

		expect(recordTitle(products, { id: 1, name: 'Linen shirt', sku: 'LS-042' })).toBe(
			'Linen shirt (LS-042)'
		);
	});

	it('is the id when the function returns empty text', () => {
		const products = defineResource({
			name: 'products',
			label: 'Products',
			schema,
			recordTitle: (product) => product.size ?? ''
		});

		expect(recordTitle(products, { id: 8, name: 'Linen shirt', sku: 'LS-042' })).toBe('8');
	});

	it('is checked at startup: a key that names no Field throws', () => {
		expect(() =>
			defineResource({
				name: 'products',
				label: 'Products',
				schema,
				// A JavaScript app, or a cast, gets past TypeScript.
				recordTitle: 'title' as 'name'
			})
		).toThrow(/Resource "products": `recordTitle` names "title", which is not one of its Fields/);
	});

	it('is checked at startup: a key that names a hidden Field throws, since a title is shown', () => {
		expect(() =>
			defineResource({
				name: 'accounts',
				label: 'Accounts',
				schema: z.object({ id: z.number(), secret: field(z.string(), { hidden: true }) }),
				recordTitle: 'secret'
			})
		).toThrow(/Resource "accounts": `recordTitle` names the hidden Field "secret"/);
	});
});
