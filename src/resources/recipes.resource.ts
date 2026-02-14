import { getRequestEvent } from '$app/server';
import { badgeVariants } from '$lib/components/ui/badge';
import { renderSnippet } from '$lib/components/ui/data-table';
import { defineField, defineResource } from '$lib/resource';
import type { FieldRenderContext } from '$lib/resource';
import { CookingPotIcon } from '@lucide/svelte';
import { createRawSnippet } from 'svelte';
import { z } from 'zod';

const recipesSchema = z.object({
	id: defineField(z.number(), { hidden: true }),
	name: defineField(z.string(), { label: 'Recipe Name', order: 1 }),
	ingredients: defineField(z.array(z.string()), {
		views: { list: { hidden: true } },
		order: 5
	}),
	instructions: defineField(z.array(z.string()), {
		views: { list: { hidden: true } },
		order: 6
	}),
	prepTimeMinutes: defineField(z.number(), {
		label: 'Prep Time (min)',
		views: { list: { hidden: true } },
		order: 3
	}),
	cookTimeMinutes: defineField(z.number(), {
		label: 'Cook Time (min)',
		views: { list: { hidden: true } },
		order: 4
	}),
	servings: defineField(z.number(), { views: { list: { hidden: true } }, order: 7 }),
	difficulty: defineField(z.string(), { order: 2 }),
	cuisine: defineField(z.string(), { order: 8 }),
	caloriesPerServing: defineField(z.number(), { label: 'Calories', order: 9 }),
	tags: defineField(z.array(z.string()), { views: { list: { hidden: true } } }),
	userId: defineField(z.number(), { hidden: true }),
	image: defineField(z.url(), { views: { list: { hidden: true } } }),
	rating: defineField(z.number(), { readOnly: true, order: 10 }),
	reviewCount: defineField(z.number(), { label: 'Reviews', readOnly: true, order: 11 }),
	mealType: defineField(z.array(z.string()), {
		label: 'Meal Type',
		order: 12,
		views: {
			list: {
				render: ({ value }: FieldRenderContext) => {
					const types = Array.isArray(value) ? value : [];
					return renderSnippet(
						createRawSnippet(() => ({
							render: () =>
								`<div class="flex gap-1">${types.map((t) => `<span class="${badgeVariants({ variant: 'outline' })}">${t}</span>`).join('')}</div>`
						}))
					);
				}
			}
		}
	})
});

export const resource = defineResource('recipes')({
	schema: recipesSchema,
	label: 'Recipes',
	icon: CookingPotIcon,
	selectable: true,
	// searchable: false,
	provider: (schema) => ({
		getMany: async ({ pagination, search }) => {
			const { fetch } = getRequestEvent();

			const limit = pagination?.pageSize ?? 30;
			const skip = (pagination?.pageIndex ?? 0) * limit;

			const path = search ? '/search' : '';
			const url = new URL(`https://dummyjson.com/recipes${path}`);

			url.searchParams.set('limit', limit.toString());
			url.searchParams.set('skip', skip.toString());
			if (search) url.searchParams.set('q', search);

			const response = await fetch(url);
			const data = await response.json();

			return {
				data: z.array(schema).parse(data.recipes),
				pageCount: Math.ceil(data.total / limit),
				total: data.total
			};
		},
		getOne: async (id) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`https://dummyjson.com/recipes/${id}`);
			const data = await response.json();
			return {
				data: schema.parse(data)
			};
		},
		create: async (data) => {
			const { fetch } = getRequestEvent();

			const response = await fetch('https://dummyjson.com/recipes/add', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
			const result = await response.json();
			return {
				data: schema.parse(result)
			};
		},
		update: async ({ id, payload }) => {
			const { fetch } = getRequestEvent();

			const response = await fetch(`https://dummyjson.com/recipes/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = await response.json();
			return {
				data: schema.parse(result)
			};
		},
		deleteOne: async (id) => {
			const { fetch } = getRequestEvent();

			const response = await fetch(`https://dummyjson.com/recipes/${id}`, {
				method: 'DELETE'
			});
			const result = await response.json();
			return {
				data: result
			};
		}
	})
});
