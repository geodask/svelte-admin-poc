import { defineAdmin, type ResourceNameOf } from '@svelte-admin/core';
import { posts } from '#lib/resources/posts.ts';
import { recipes } from '#lib/resources/recipes.ts';
import { users } from '#lib/resources/users.ts';

export const admin = defineAdmin({
	basePath: '/admin',
	resources: {
		recipes: { resource: recipes, remote: () => import('#lib/resources/recipes.remote.ts') },
		posts: { resource: posts, remote: () => import('#lib/resources/posts.remote.ts') },
		users: { resource: users, remote: () => import('#lib/resources/users.remote.ts') }
	}
});

export type ResourceName = ResourceNameOf<typeof admin>;
