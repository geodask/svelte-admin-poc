// PROTOTYPE (PER-17): the one line of wiring per Resource, plus a prototype-only debug query.
import { query } from '$app/server';
import { serveResource } from './framework/serve-resource';
import { recipes } from './recipes';
import { memoryProvider, lastWrite } from './server/memory-provider';

export const { getList, getOne, create, update } = serveResource(recipes, memoryProvider);

export const getLastWrite = query(async () => ({ ...lastWrite }));
