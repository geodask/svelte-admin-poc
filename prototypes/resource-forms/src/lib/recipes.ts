// PROTOTYPE (PER-17): the shared Resource module (client-safe). One Resource that covers every
// Field kind the ticket asks about.
import { z } from 'zod';
import { defineResource, field } from './framework/resource';

export const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: field(z.number(), { hidden: true }),
		name: field(z.string().min(2), { label: 'Recipe name' }),
		summary: field(z.string().max(280).optional(), {
			input: 'textarea',
			description: 'Optional. Shown on the recipe card.'
		}),
		cuisine: z.enum(['Italian', 'Greek', 'Japanese', 'Mexican', 'Indian']),
		difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
		servings: z.number().int().min(1),
		caloriesPerServing: field(z.number().positive().optional(), { label: 'Calories per serving' }),
		vegetarian: z.boolean(),
		publishedOn: field(z.date().optional(), { label: 'Published on' }),
		image: field(z.url().optional(), { label: 'Image URL', placeholder: 'https://…' }),
		tags: z.array(z.string().max(20)),
		ingredients: z
			.array(z.object({ name: z.string(), quantity: z.string().optional() }))
			.min(1, 'Add at least one ingredient'),
		nutrition: z
			.object({ protein: z.number().nonnegative(), carbs: z.number().nonnegative().optional() })
			.optional(),
		rating: field(z.number(), { readOnly: true }),
		createdAt: field(z.date(), { readOnly: true, label: 'Created' })
	})
});

export type Recipe = z.infer<typeof recipes.schema>;
