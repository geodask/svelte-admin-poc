// The posts Provider: the bundled REST Provider's methods (so its `getList` forwards the page, the
// page size, the sort and the filters), but not its `getMany`, plus `deleteMany` over the demo
// backend's bulk route, which the REST convention doesn't have. It shows how an app spreads the
// bundled Provider for one Resource, adding a method and leaving one out. Recipes and users have
// no bulk route, so their bulk deletes fall back to one `deleteOne` per id. Without `getMany`, the
// posts that a page's posts reply to are looked up with one `getOne` each, so the demo covers
// that fallback. Server-only, like `backend.ts`.
import { NotFoundError, type ResourceProvider } from '@svelte-admin/core';
import { BACKEND_URL } from '../../../backend/config.ts';
import { posts } from '#lib/resources/posts.ts';
import { backend } from './backend.ts';

/** The Provider for posts: the bundled REST Provider's methods but `getMany`, plus `deleteMany`. */
export const postsProvider: ResourceProvider<typeof posts> = {
	...backend.for(posts),
	// Left out, so the admin looks posts up with `getOne`, one request per id.
	getMany: undefined,
	/** `DELETE /posts?id=1&id=2`: all of them, or none (a 404 when any doesn't exist). */
	async deleteMany({ fetch }, ids) {
		const query = new URLSearchParams(ids.map((id) => ['id', String(id)]));
		const response = await fetch(`${BACKEND_URL}/posts?${query}`, { method: 'DELETE' });
		// Nothing is read from the response, so free its body.
		await response.body?.cancel();
		if (response.status === 404) throw new NotFoundError();
		if (!response.ok) {
			throw new Error(`Posts Provider: DELETE /posts failed with ${response.status}`);
		}
	}
};
