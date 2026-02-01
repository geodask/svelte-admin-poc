import { defineResource } from '$lib/resource';
import { z } from 'zod';
import { getRequestEvent } from '$app/server';

const berrySchema = z.object({
	name: z.string(),
	size: z.number().optional()
});

// export const resource = defineResource('berries')({
// 	schema: berrySchema,
// 	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry'),
// 	label: 'Berries',
// 	columns: [
// 		{ accessorKey: 'name', header: 'Name' },
// 		{ accessorKey: 'url', header: 'URL' },
// 		{ accessorKey: 'size', header: 'Size' }
// 	]
// });

export const resource = defineResource('berries')({
	schema: berrySchema,
	provider: (schema) => ({
		getMany: async () => {
			const { fetch } = getRequestEvent();
			const url = 'https://pokeapi.co/api/v2/berry';
			const response = await fetch(url);
			const result = await response.json();
			const detailedBerries = await Promise.all(
				result.results.map(async (berry: { url: string }) => {
					const res = await fetch(berry.url);
					const detailedBerry = await res.json();
					return {
						name: detailedBerry.name,
						size: detailedBerry.size
					};
				})
			);
			return {
				total: detailedBerries.length,
				data: schema.array().parse(detailedBerries)
			};
		},
		create: async () => {
			return {
				data: { name: '' }
			};
		},
		deleteOne: async () => {
			return {
				data: { name: '' }
			};
		},
		getOne: async (id) => {
			const { fetch } = getRequestEvent();
			const url = `https://pokeapi.co/api/v2/berry/${id}`;
			const response = await fetch(url);
			const data = await response.json();
			return {
				data: schema.parse(data)
			};
		},
		update: async () => {
			return { data: { name: '' } };
		}
	}),
	label: 'Berries',
	columns: [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'size', header: 'Size' }
	]
});
