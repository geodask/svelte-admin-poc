import { serveResource } from '@svelte-admin/core/server';
import { backend } from '#lib/server/backend.ts';
import { recipes } from './recipes.ts';

export const { getList, getOne, create, update, deleteOne, deleteMany } = serveResource(
	recipes,
	backend.for(recipes)
);
