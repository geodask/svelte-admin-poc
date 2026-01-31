import { defineResource, simpleRestProvider } from './resource';

export const resource = defineResource('a')({
	provider: simpleRestProvider('https://swapi.dev/api/people')
});
