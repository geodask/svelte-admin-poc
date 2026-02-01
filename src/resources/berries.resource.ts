import { defineResource, simpleRestProvider } from './resource';

export const resource = defineResource('berries')({
	provider: simpleRestProvider('https://pokeapi.co/api/v2/berry'),
	label: 'Berries',
	columns: [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'url', header: 'URL' },
		{ accessorKey: 'size', header: 'size' }
	]
});
	