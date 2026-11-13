import { defineResource } from '@svelte-admin/core';
import { z } from 'zod';

export const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		name: z.string(),
		cuisine: z.string(),
		difficulty: z.enum(['Easy', 'Medium', 'Hard']),
		prepTimeMinutes: z.number(),
		servings: z.number(),
		tags: z.array(z.string())
	})
});
