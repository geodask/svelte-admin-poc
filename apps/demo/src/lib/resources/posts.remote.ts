import { serveResource } from '@svelte-admin/core/server';
import { postsProvider } from '#lib/server/posts-provider.ts';
import { posts } from './posts.ts';

export const { getList, getOne, create, update, deleteOne, deleteMany } = serveResource(
	posts,
	postsProvider
);
