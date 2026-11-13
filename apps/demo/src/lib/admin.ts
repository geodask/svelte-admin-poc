import { defineAdmin, type ResourceNameOf } from '@svelte-admin/core';
import { recipes } from '#lib/resources/recipes.ts';

export const admin = defineAdmin({
	basePath: '/admin',
	resources: {
		recipes: { resource: recipes, remote: () => import('#lib/resources/recipes.remote.ts') }
	}
});

export type ResourceName = ResourceNameOf<typeof admin>;
