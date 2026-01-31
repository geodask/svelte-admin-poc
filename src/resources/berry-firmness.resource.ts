import { defineResource, simpleRestProvider } from './resource';

export const resource = defineResource('berry-firmness')({
	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry-firmness')
});
