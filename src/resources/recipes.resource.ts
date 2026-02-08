import { defineResource } from '$lib/resource';
import { CookingPotIcon } from '@lucide/svelte';
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
	provider: (schema) => ({
		getMany: async () => {
			const response = await fetch('https://dummyjson.com/recipes');
			const data = await response.json();
			return {
				data: z.array(schema).parse(data.recipes),
				total: data.total
			};
		},
		getOne: async (id) => {
			const response = await fetch(`https://dummyjson.com/recipes/${id}`);
			const data = await response.json();
			return {
				data: schema.parse(data)
			};
		},
		create: async (data) => {
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
			header: 'Meal Type'
		}
	]
});
