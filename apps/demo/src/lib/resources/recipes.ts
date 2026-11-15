import { defineResource, field } from '@svelte-admin/core';
import { z } from 'zod';

export const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	icon: () => import('@lucide/svelte/icons/chef-hat'),
	group: 'Content',
	// The demo backend searches recipes by their text Fields.
	searchable: true,
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
		// Edited as one textarea, one tag per line. Posts' tags keep one input per tag.
		tags: field(z.array(z.string()), { input: 'lines' }),
		// An array of objects: edited as one fieldset per ingredient, and never left empty.
		ingredients: z
			.array(z.object({ name: z.string(), quantity: z.string().optional() }))
			.min(1, 'Add at least one ingredient'),
		reviewCount: z.number(),
		publishedAt: z.iso.datetime(),
		// A number or a slug: no built-in Kind fits, so it shows as unknown.
		sourceId: z.union([z.string(), z.number()]),
		// An object: left off the list by default, and edited as a group of inputs.
		nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
		instructions: field(z.string(), {
			list: false,
			description: 'How to cook it',
			input: 'textarea'
		}),
		internalNotes: field(z.string(), { hidden: true })
	})
});
