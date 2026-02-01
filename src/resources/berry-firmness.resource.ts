import { defineResource, simpleRestProvider } from '$lib/resource';
import { z } from 'zod';

const schema = z.object({
	name: z.string(),
	url: z.string()
});

export const resource = defineResource('berry-firmness')({
	schema,
	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry-firmness')
});
