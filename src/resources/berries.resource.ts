import { getRequestEvent } from '$app/server';
import { defineResource } from '$lib/resource';
import { CherryIcon } from '@lucide/svelte';
import { z } from 'zod';

const berrySchema = z.object({
	id: z.number(),
	name: z.string(),
	size: z.number().optional()
});

export const resource = defineResource('berries')({
	schema: berrySchema,
	icon: CherryIcon,
	provider: (schema) => ({
		getMany: async () => {
			const { fetch } = getRequestEvent();
			const url = 'https://pokeapi.co/api/v2/berry';
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch berries: ${response.status} ${response.statusText}`);
			}
			const result = await response.json();
			const detailedBerries = await Promise.all(
				result.results.map(async (berry: { url: string }) => {
					const res = await fetch(berry.url);
					if (!res.ok) {
						throw new Error(`Failed to fetch berry details: ${res.status}`);
					}
					const detailedBerry = await res.json();
					return {
						id: detailedBerry.id,
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
		getOne: async (id) => {
			const { fetch } = getRequestEvent();
			const url = `https://pokeapi.co/api/v2/berry/${id}`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch berry: ${response.status} ${response.statusText}`);
			}
			const data = await response.json();
			return {
				data: schema.parse(data)
			};
		},
		create: async (input) => {
			return { data: input as z.infer<typeof schema> };
		},
		update: async ({ payload }) => {
			return { data: payload as z.infer<typeof schema> };
		},
		deleteOne: async () => {
			return {};
		}
	}),
	label: 'Berries',
	columns: [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'size', header: 'Size' }
		// {
		// 	id: 'action',
		// 	cell: ({ row }) => {
		// 		const snippet = createRawSnippet(() => ({
		// 			render: () => `<div class="text-end">View ${row.original.name}</div>`
		// 		}));
		// 		return renderSnippet(snippet);
		// 	}
		// }
	]
});
