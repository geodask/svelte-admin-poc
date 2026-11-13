// Type-level tests, checked by `tsc` (`bun run check`), never run. Each `@ts-expect-error`
// fails the check if the line below it stops being a type error.
import { z } from 'zod';
import { defineAdmin, defineResource, type Provider } from '@svelte-admin/core';
import { serveResource } from '@svelte-admin/core/server';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});

type Recipe = { id: number; name: string };

const recipeProvider: Provider<Recipe> = {
	getList: async () => ({ data: [{ id: 1, name: 'Classic Margherita Pizza' }], total: 1 })
};

const userProvider: Provider<{ id: number; email: string }> = {
	getList: async () => ({ data: [], hasNextPage: false })
};

// A Provider whose records match the schema is accepted, and what it serves fits admin.ts.
const recipesRemote = serveResource(recipes, recipeProvider);
defineAdmin({
	basePath: '/admin',
	resources: { recipes: { resource: recipes, remote: async () => recipesRemote } }
});

// @ts-expect-error a Resource cannot be served without a Provider
serveResource(recipes);

// @ts-expect-error the Provider's records must match the Resource schema
serveResource(recipes, userProvider);

// A string id is fine too.
defineResource({ name: 'posts', label: 'Posts', schema: z.object({ id: z.string() }) });

defineResource({
	name: 'notes',
	label: 'Notes',
	// @ts-expect-error the schema must have an `id` Field
	schema: z.object({ title: z.string() })
});

defineResource({
	name: 'flags',
	label: 'Flags',
	// @ts-expect-error the `id` Field must be a string or a number
	schema: z.object({ id: z.boolean() })
});

defineResource({
	name: 'tags',
	label: 'Tags',
	// @ts-expect-error the `id` Field must not coerce ('1' and 1 would both become ids)
	schema: z.object({ id: z.coerce.number() })
});

defineResource({
	name: 'drafts',
	label: 'Drafts',
	// @ts-expect-error the `id` Field must not be optional
	schema: z.object({ id: z.number().optional() })
});
