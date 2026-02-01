import { defineResource, simpleRestProvider } from '$lib/resource';
import { z } from 'zod';

const schema = z.object({
	name: z.string(),
	url: z.string()
});

// export const resource = defineResource('berry-flavors')({
// 	schema,
// 	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry-flavor'),
// });

export const resource = defineResource('berry-flavors')({
	schema,
	provider: () => ({
		getOne: async ({ id }) => {
			const response = await fetch(`https://pokeapi.co/api/v2/berry-flavor/${id}`);
			const data = await response.json();
			return { data };
		},
		getMany: async () => {
			const response = await fetch(`https://pokeapi.co/api/v2/berry-flavor`);
			const result = await response.json();
			return { data: result.results, total: result.count };
		},
		create: async ({ variables }) => {
			const response = await fetch(`https://pokeapi.co/api/v2/berry-flavor`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(variables)
			});
			const result = await response.json();
			return { data: result };
		},
		update: async ({ id, variables }) => {
			const response = await fetch(`https://pokeapi.co/api/v2/berry-flavor/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(variables)
			});
			const result = await response.json();
			return { data: result };
		},
		deleteOne: async ({ id }) => {
			await fetch(`https://pokeapi.co/api/v2/berry-flavor/${id}`, { method: 'DELETE' });
			return { data: null };
		}
	})
});
