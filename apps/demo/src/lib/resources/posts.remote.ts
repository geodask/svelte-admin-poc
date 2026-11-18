import { serveResource } from '@svelte-admin/core/server';
import { postsProvider } from '#lib/server/posts-provider.ts';
import { posts } from './posts.ts';

// Exports stop at 50 posts, so with the 60 seeded ones the e2e suite covers the cap, and the
// export pages through a backend that answers with `hasNextPage` instead of a total.
export const { getList, getOne, create, update, deleteOne, deleteMany, exportList } = serveResource(
	posts,
	postsProvider,
	{ maxExportRows: 50 }
);
