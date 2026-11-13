import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineResource, type ProviderContext } from '@svelte-admin/core';
import { restProvider } from '@svelte-admin/core/rest';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});

/** A fake `fetch` that records each request and answers with `body`. */
function fakeFetch(body: unknown, init: ResponseInit = { status: 200 }) {
	const requests: string[] = [];
	const fetch: typeof globalThis.fetch = async (input) => {
		requests.push(input instanceof Request ? input.url : String(input));
		return new Response(JSON.stringify(body), {
			...init,
			headers: { 'content-type': 'application/json' }
		});
	};
	return { fetch, requests };
}

function context(fetch: typeof globalThis.fetch): ProviderContext {
	return { fetch, locals: {} };
}

describe('the bundled REST Provider', () => {
	describe('getList', () => {
		it('requests GET {base}/{resource}?page=&perPage= with the context fetch', async () => {
			const { fetch, requests } = fakeFetch({ data: [], total: 0 });
			const provider = restProvider('http://api.test').for(recipes);

			await provider.getList(context(fetch), { page: 2, perPage: 10 });

			expect(requests).toEqual(['http://api.test/recipes?page=2&perPage=10']);
		});

		it('keeps a path in the base URL and ignores a trailing slash', async () => {
			const { fetch, requests } = fakeFetch({ data: [], total: 0 });
			const provider = restProvider('http://api.test/v1/').for(recipes);

			await provider.getList(context(fetch), { page: 1, perPage: 25 });

			expect(requests).toEqual(['http://api.test/v1/recipes?page=1&perPage=25']);
		});

		it('returns { data, total } as the backend sent it', async () => {
			const data = [
				{ id: 1, name: 'Classic Margherita Pizza' },
				{ id: 2, name: 'Vegetarian Stir-Fry' }
			];
			const { fetch } = fakeFetch({ data, total: 42 });

			const result = await restProvider('http://api.test')
				.for(recipes)
				.getList(context(fetch), { page: 1, perPage: 2 });

			expect(result).toEqual({ data, total: 42 });
		});

		it('returns { data, hasNextPage } for a backend that cannot count', async () => {
			const data = [{ id: 3, name: 'Chocolate Chip Cookies' }];
			const { fetch } = fakeFetch({ data, hasNextPage: true });

			const result = await restProvider('http://api.test')
				.for(recipes)
				.getList(context(fetch), { page: 1, perPage: 1 });

			expect(result).toEqual({ data, hasNextPage: true });
		});

		it('rejects a response that is neither shape', async () => {
			const { fetch } = fakeFetch([{ id: 1, name: 'A bare array' }]);

			await expect(
				restProvider('http://api.test')
					.for(recipes)
					.getList(context(fetch), { page: 1, perPage: 25 })
			).rejects.toThrow(/REST Provider/);
		});

		it('rejects when the backend answers with an error status', async () => {
			const { fetch } = fakeFetch({ message: 'boom' }, { status: 500 });

			await expect(
				restProvider('http://api.test')
					.for(recipes)
					.getList(context(fetch), { page: 1, perPage: 25 })
			).rejects.toThrow(/500/);
		});
	});
});
