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
		// The demo backend can sort by any Field; these four are offered as the list's sort.
		// Filtered with a text box that matches part of the name (`contains`).
		name: field(z.string(), {
			placeholder: 'e.g. Classic Margherita Pizza',
			sortable: true,
			filterable: true
		}),
		// Narrowed to exact matches: a text box that filters with `eq`, never `contains`. The URL
		// takes several values too, as `in`.
		cuisine: field(z.string(), { placeholder: 'e.g. Italian', filterable: ['eq', 'in'] }),
		// Filtered with a checkbox per difficulty: one gives `eq`, several `in`.
		difficulty: field(z.enum(['Easy', 'Medium', 'Hard']), { filterable: true }),
		// Filtered with a from and a to input (`gte` and `lte`).
		prepTimeMinutes: field(z.number(), {
			label: 'Prep time (min)',
			sortable: true,
			filterable: true
		}),
		servings: z.number(),
		// Metadata set before `.optional()` still applies. Some recipes have no calorie count,
		// and those come last in either order.
		caloriesPerServing: field(z.number(), { label: 'Calories', sortable: true }).optional(),
		// Filtered with Any / Yes / No.
		vegetarian: field(z.boolean(), { filterable: true }),
		// Edited as one textarea, one tag per line. Posts' tags keep one input per tag.
		tags: field(z.array(z.string()), { input: 'lines' }),
		// An array of objects: edited as one fieldset per ingredient, and never left empty.
		ingredients: z
			.array(z.object({ name: z.string(), quantity: z.string().optional() }))
			.min(1, 'Add at least one ingredient'),
		// Counted by the backend: it starts at 0, and no form can set it.
		reviewCount: field(z.number(), { readOnly: true }),
		// Filtered with a from and a to date and time, in UTC.
		publishedAt: field(z.iso.datetime(), { sortable: true, filterable: true }),
		// A number or a slug: no built-in Kind fits, so it shows as unknown. The forms have no
		// input for it either, so it must be read-only (the backend sets it) or hidden.
		sourceId: field(z.union([z.string(), z.number()]), { readOnly: true }),
		// An object: left off the list by default, and edited as a group of inputs.
		nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
		instructions: field(z.string(), {
			list: false,
			description: 'How to cook it',
			input: 'textarea'
		}),
		// In no View, so the forms leave it alone and the backend keeps it.
		internalNotes: field(z.string(), { hidden: true })
	})
});
