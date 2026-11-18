import { serveResource } from '@svelte-admin/core/server';
import { backend } from '#lib/server/backend.ts';
import { users } from './users.ts';

export const { getList, getOne, lookup, create, update, deleteOne, deleteMany, exportList } =
	serveResource(users, backend.for(users));
