// PROTOTYPE (PER-18): the shared Resource module (client-safe).
import { z } from 'zod';
import { defineResource, field } from './core/resource';

export const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	singular: 'recipe',
	schema: z.object({
		id: field(z.number(), { hidden: true }),
		name: field(z.string().min(2), { sortable: true }),
		cuisine: field(z.enum(['Italian', 'Greek', 'Japanese', 'Mexican', 'Indian']), { sortable: true, filterable: true }),
		difficulty: field(z.enum(['Easy', 'Medium', 'Hard']).optional(), { filterable: true }),
		servings: field(z.number().int().min(1), { sortable: true }),
		vegetarian: field(z.boolean(), { filterable: true }),
		publishedOn: field(z.date().optional(), { label: 'Published', sortable: true }),
		tags: z.array(z.string()),
		rating: field(z.number(), { sortable: true })
	})
});

export type Recipe = z.infer<typeof recipes.schema>;
