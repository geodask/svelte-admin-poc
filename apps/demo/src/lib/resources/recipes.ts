import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';

export const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	// The key order is the display order. Recipes hold a Field of every built-in Kind.
	schema: z.object({
		id: z.number(),
		name: z.string(),
		cuisine: z.string(),
		difficulty: z.enum(['Easy', 'Medium', 'Hard']),
		prepTimeMinutes: field(z.number(), { label: 'Prep time (min)' }),
		servings: z.number(),
		// Metadata set before `.optional()` still applies.
		caloriesPerServing: field(z.number(), { label: 'Calories' }).optional(),
		vegetarian: z.boolean(),
		tags: z.array(z.string()),
		reviewCount: z.number(),
		publishedAt: z.iso.datetime(),
		// A number or a slug: no built-in Kind fits, so it shows as unknown.
		sourceId: z.union([z.string(), z.number()]),
		// An object: left off the list by default.
		nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
		instructions: field(z.string(), { list: false, description: 'How to cook it' }),
		internalNotes: field(z.string(), { hidden: true })
	})
});
