// The posts Provider: the bundled REST Provider, plus `deleteMany` over the demo backend's bulk
// route, which the REST convention doesn't have. It shows how an app adds a method to the
// bundled Provider for one Resource by spreading it. Recipes and users have no bulk route, so
// their bulk deletes fall back to one `deleteOne` per id. Server-only, like `backend.ts`.
import { NotFoundError } from '@svelte-admin/core';
import { BACKEND_URL } from '../../../backend/config.ts';
import { posts } from '#lib/resources/posts.ts';
import { backend } from './backend.ts';

const rest = backend.for(posts);

/** The Provider for posts: the bundled REST Provider's methods, plus `deleteMany`. */
export const postsProvider: typeof rest = {
	...rest,
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
