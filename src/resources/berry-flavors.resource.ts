import { defineResource, simpleRestProvider } from './resource';

export const resource = defineResource('berry-flavors')({
	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry-flavor')
});
