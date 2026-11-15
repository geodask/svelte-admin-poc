import { describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { z } from 'zod';
import { defineAdmin, defineResource, type ResourceRemote } from '@svelte-admin/core';

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

// The remote functions only run inside a SvelteKit app; these tests never call them.
const remote = async () => ({ getList: () => {} }) as unknown as ResourceRemote;

const admin = defineAdmin({
	basePath: '/admin',
	resources: {
		recipes: { resource: recipes, remote },
		users: { resource: users, remote }
	}
});

describe('defineAdmin', () => {
	it('keeps the base path and the Resources by name', () => {
		expect(admin.basePath).toBe('/admin');
		expect(admin.resources.users.resource).toBe(users);
	});

	describe('matchResource, the param matcher', () => {
		it('matches each Resource name in admin.ts', () => {
			expect(admin.matchResource('recipes')).toBe('recipes');
			expect(admin.matchResource('users')).toBe('users');
		});

		it.each(['nope', 'Recipes', 'recipe', ''])('does not match %j', (param) => {
			expect(admin.matchResource(param)).toBeUndefined();
		});

		it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf'])(
			'does not match the inherited object key %j',
			(param) => {
				expect(admin.matchResource(param)).toBeUndefined();
			}
		);
	});

	it('rejects a Resource listed under a key other than its name', () => {
		expect(() =>
			defineAdmin({
				basePath: '/admin',
				// @ts-expect-error the key must be the Resource's name
				resources: { cookbook: { resource: recipes, remote } }
			})
		).toThrow(/"recipes".*"cookbook"/);
	});

	it.each(['admin', '/admin/', ''])('rejects the base path %j', (basePath) => {
		expect(() => defineAdmin({ basePath, resources: {} })).toThrow(/base path/i);
	});
});

describe('the sidebar', () => {
	// Stand-ins for Lucide icons: lazy imports of a component, as an app writes them.
	const bookIcon = async () => ({ default: (() => {}) as unknown as Component });
	const userIcon = async () => ({ default: (() => {}) as unknown as Component });

	const resource = <const N extends string>(
		name: N,
		label: string,
		extra: { group?: string; icon?: typeof bookIcon }
	) => defineResource({ name, label, schema: z.object({ id: z.number() }), ...extra });

	const shop = defineAdmin({
		basePath: '/shop/admin',
		resources: {
			orders: { resource: resource('orders', 'Orders', { group: 'Sales' }), remote },
			customers: {
				resource: resource('customers', 'Customers', { group: 'People', icon: userIcon }),
				remote
			},
			settings: { resource: resource('settings', 'Settings', {}), remote },
			invoices: {
				resource: resource('invoices', 'Invoices', { group: 'Sales', icon: bookIcon }),
				remote
			}
		}
	});

	it('groups the Resources in the order each group first appears in admin.ts', () => {
		expect(shop.sidebar.map((group) => group.label)).toEqual(['Sales', 'People', undefined]);
	});

	it('keeps admin.ts order inside a group', () => {
		expect(shop.sidebar[0].items.map((item) => item.name)).toEqual(['orders', 'invoices']);
	});

	it('gives each item its label, icon and list href under the base path', () => {
		expect(shop.sidebar[0].items[1]).toEqual({
			name: 'invoices',
			label: 'Invoices',
			href: '/shop/admin/invoices',
			icon: bookIcon
		});
		expect(shop.sidebar[2].items).toEqual([
			{ name: 'settings', label: 'Settings', href: '/shop/admin/settings', icon: undefined }
		]);
	});

	it('is empty for an admin without Resources', () => {
		expect(defineAdmin({ basePath: '/admin', resources: {} }).sidebar).toEqual([]);
	});
});

describe('locate, the Resource and record a path is on', () => {
	it('finds the Resource on its list View', () => {
		expect(admin.locate('/admin/recipes')).toEqual({
			name: 'recipes',
			resource: recipes,
			remote,
			listHref: '/admin/recipes',
			view: 'list',
			id: undefined
		});
	});

	it('finds the Resource and the typed id on a detail View', () => {
		expect(admin.locate('/admin/recipes/12')).toMatchObject({
			name: 'recipes',
			view: 'detail',
			id: 12
		});
	});

	it.each([
		['/admin/recipes/new', 'recipes'],
		['/admin/users/new', 'users']
	])('finds the Resource and no id on the create View %j', (path, name) => {
		expect(admin.locate(path)).toMatchObject({ name, view: 'create', id: undefined });
	});

	it.each([
		['/admin/recipes/12/edit', 'recipes', 12],
		['/admin/users/a%2Fb/edit', 'users', 'a/b']
	])('finds the Resource and the typed id on the edit View %j', (path, name, id) => {
		expect(admin.locate(path)).toMatchObject({ name, view: 'edit', id });
	});

	it.each([
		['/admin/recipes/abc/edit', 'recipes'],
		['/admin/recipes/new/edit', 'recipes']
	])('finds the edit View but no id on %j', (path, name) => {
		expect(admin.locate(path)).toMatchObject({ name, view: 'edit', id: undefined });
	});

	it('decodes a string id from its path segment', () => {
		expect(admin.locate('/admin/users/a%2Fb%20c')).toMatchObject({ name: 'users', id: 'a/b c' });
	});

	it.each([
		['/admin/recipes/abc', 'recipes'],
		['/admin/recipes/01', 'recipes'],
		['/admin/users/%E0%A4%A', 'users']
	])('finds the Resource but no id on %j', (path, name) => {
		expect(admin.locate(path)).toMatchObject({ name, view: 'detail', id: undefined });
	});

	it.each([
		'/admin',
		'/admin/',
		'/admin/nope',
		'/admin/toString',
		'/admin/Recipes',
		'/adminx/recipes',
		'/recipes',
		'/other/admin/recipes'
	])('finds nothing on %j', (path) => {
		expect(admin.locate(path)).toBeUndefined();
	});
});

describe('homeHref, where the admin index leads', () => {
	it('is the first Resource list in admin.ts', () => {
		expect(admin.homeHref).toBe('/admin/recipes');
	});

	it('is undefined for an admin without Resources', () => {
		expect(defineAdmin({ basePath: '/admin', resources: {} }).homeHref).toBeUndefined();
	});
});
