import { describe, expect, it } from 'vitest';
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
