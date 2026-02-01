import { defineResource } from './resource';
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
	provider: (schema) => {
		return {
			getMany: async () => {
				const { fetch } = getRequestEvent();
				const url = 'https://pokeapi.co/api/v2/berry';
				const response = await fetch(url);
				const result = await response.json();
				const detailedBerries = await Promise.all(
					result.results.map(async (berry: { url: string }) => {
						const res = await fetch(berry.url);
						console.log('Fetched berry:', berry.url);
						const detailedBerry = await res.json();
						return {
							name: detailedBerry.name,
							size: detailedBerry.size
						};
					})
				);
				console.log(detailedBerries);
				return z.array(schema).parse(detailedBerries);
			},
			create: async () => {
				throw new Error('Not implemented');
			},
			delete: async () => {},
			getOne: async (id: string) => {
				const { fetch } = getRequestEvent();
				const url = `https://pokeapi.co/api/v2/berry/${id}`;
				const response = await fetch(url);
				const data = await response.json();
				return schema.parse(data);
			},
			update: async () => {
				throw new Error('Not implemented');
			}
		};
	},
	label: 'Berries',
	columns: [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'size', header: 'Size' }
	]
});
