import { getRequestEvent } from '$app/server';
import { renderSnippet } from '$lib/components/ui/data-table';
import { badgeVariants } from '$lib/components/ui/badge';
import { defineResource } from '$lib/resource';
import { CookingPotIcon } from '@lucide/svelte';
import { createRawSnippet } from 'svelte';
import { z } from 'zod';

const recipesSchema = z.object({
	// Define your schema here
	id: z.number(),
	name: z.string(),
	ingredients: z.array(z.string()),
	instructions: z.array(z.string()),
	prepTimeMinutes: z.number(),
	cookTimeMinutes: z.number(),
	servings: z.number(),
	difficulty: z.string(),
	cuisine: z.string(),
	caloriesPerServing: z.number(),
	tags: z.array(z.string()),
	userId: z.number(),
	image: z.url(),
	rating: z.number(),
	reviewCount: z.number(),
	mealType: z.array(z.string())
});


export const resource = defineResource('recipes')({
	schema: recipesSchema,
	label: 'Recipes',
	icon: CookingPotIcon,
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
	}),

	columns: [
		{
			accessorKey: 'name',
			header: 'Name'
		},
		{
			accessorKey: 'difficulty',
			header: 'Difficulty'
		},
		{
			accessorKey: 'cuisine',
			header: 'Cuisine'
		},
		{
			accessorKey: 'caloriesPerServing',
			header: 'Calories'
		},
		{
			accessorKey: 'rating',
			header: 'Rating'
		},
		{
			accessorKey: 'reviewCount',
			header: 'Reviews'
		},
		{
			accessorKey: 'mealType',
			header: 'Meal Type',
			cell: ({ getValue }) => {
				const value = getValue();
				const types = Array.isArray(value) ? value : [];
				return renderSnippet(
					createRawSnippet(() => ({
						render: () =>
							`<div class="flex gap-1">${types.map((t) => `<span class="${badgeVariants({ variant: 'outline' })}">${t}</span>`).join('')}</div>`
					}))
				);
			}
		}
	]
});
