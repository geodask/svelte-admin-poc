import { defineResource, simpleRestProvider } from './resource';
import { z } from 'zod';

const schema = z.object({
	name: z.string(),
	url: z.string()
});

export const resource = defineResource('berry-flavors')({
	schema,
	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry-flavor'),
});
