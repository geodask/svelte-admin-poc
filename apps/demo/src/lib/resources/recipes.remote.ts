import { serveResource } from '@svelte-admin/core/server';
import { api } from '#lib/server/api.ts';
import { recipes } from './recipes.ts';

export const { getList } = serveResource(recipes, api.for(recipes));
