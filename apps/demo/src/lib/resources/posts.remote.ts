import { serveResource } from '@svelte-admin/core/server';
import { backend } from '#lib/server/backend.ts';
import { posts } from './posts.ts';

export const { getList, getOne } = serveResource(posts, backend.for(posts));
