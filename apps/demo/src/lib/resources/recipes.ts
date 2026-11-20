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
		// Shown as badges, the Theme's `badges` Kind, and edited as one textarea, one tag per line.
		// Posts' tags keep the built-in list, with one input per tag.
		tags: field(z.array(z.string()), { kind: 'badges', input: 'lines' }),
		// An array of objects: edited as one fieldset per ingredient, and never left empty.
		ingredients: z
			.array(z.object({ name: z.string(), quantity: z.string().optional() }))
			.min(1, 'Add at least one ingredient'),
		// Counted by the backend: it starts at 0, and no form can set it.
		reviewCount: field(z.number(), { readOnly: true }),
		// Filtered with a from and a to date and time, in UTC.
		publishedAt: field(z.iso.datetime(), { sortable: true, filterable: true }),
		// A day, with no time: edited in a `date` input, and left off the list. Some recipes have
		// never been cooked.
		lastCookedOn: field(z.iso.date(), { label: 'Last cooked', list: false }).optional(),
		// A number or a slug: no built-in Kind fits, so it shows as unknown, and the forms have no
		// built-in input for it. The app's `numberOrSlug` Kind gives it one, a text input, and
		// converts what is typed: digits are saved as a number, a slug as text.
		sourceId: field(z.union([z.string(), z.number()]), {
			kind: 'numberOrSlug',
			placeholder: 'e.g. 42 or abc-1'
		}),
		// A whole number from 1 to 5, shown as stars and set with one radio per star: the app's
		// `stars` Kind, registered in admin.ts. It still sorts as a number, and the recipes with no
		// rating come last in either order.
		rating: field(z.int().min(1).max(5), { kind: 'stars', sortable: true }).optional(),
		// An object: left off the list by default, and edited as a group of inputs.
		nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
		// Long text, the Theme's `textarea` Kind: edited in a textarea, shown with its line breaks
		// on the detail View and on one line in the list View.
		instructions: field(z.string(), { kind: 'textarea', description: 'How to cook it' }),
		// An image's URL, the Theme's `image` Kind: a thumbnail in the list View and an image on
		// the detail View. Any text is saved, but only an http(s) URL or a path on this site is
		// loaded; anything else shows as text. A few seeded recipes point to the demo's images.
		imageUrl: field(z.string(), { kind: 'image', label: 'Image' }).optional(),
		// In no View, so the forms leave it alone and the backend keeps it.
		internalNotes: field(z.string(), { hidden: true })
	})
});
