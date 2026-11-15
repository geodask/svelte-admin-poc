import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	ConflictError,
	defineResource,
	InvalidInputError,
	NotFoundError,
	type ProviderContext
} from '@svelte-admin/core';
import { restProvider } from '@svelte-admin/core/rest';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.string(), email: z.string() })
});

/** What a fake `fetch` was sent: the method, the URL, the content type and the body. */
type Sent = { method: string; url: string; contentType: string | null; body: unknown };

/**
 * A fake `fetch` that records each request (its URL in `requests`, and all of it in `sent`)
 * and answers with `body`.
 */
function fakeFetch(body: unknown, init: ResponseInit = { status: 200 }) {
	const requests: string[] = [];
	const sent: Sent[] = [];
	const fetch: typeof globalThis.fetch = async (input, requestInit) => {
		const request = new Request(input, requestInit);
		requests.push(request.url);
		const text = await request.text();
		sent.push({
			method: request.method,
			url: request.url,
			contentType: request.headers.get('content-type'),
			body: text ? JSON.parse(text) : undefined
		});
		return new Response(JSON.stringify(body), {
			...init,
			headers: { 'content-type': 'application/json' }
		});
	};
	return { fetch, requests, sent };
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

		it('sends the search as q when there is one', async () => {
			const { fetch, requests } = fakeFetch({ data: [], total: 0 });
			const provider = restProvider('http://api.test').for(recipes);

			await provider.getList(context(fetch), { page: 1, perPage: 25, search: 'chicken & rice' });

			expect(requests).toEqual(['http://api.test/recipes?page=1&perPage=25&q=chicken+%26+rice']);
		});

		it('leaves q out when there is no search', async () => {
			const { fetch, requests } = fakeFetch({ data: [], total: 0 });
			const provider = restProvider('http://api.test').for(recipes);

			await provider.getList(context(fetch), { page: 1, perPage: 25, search: undefined });

			expect(requests).toEqual(['http://api.test/recipes?page=1&perPage=25']);
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
	});

	describe('getOne', () => {
		it('requests GET {base}/{resource}/{id} with the context fetch', async () => {
			const { fetch, requests } = fakeFetch({ id: 7, name: 'Caprese Salad' });
			const provider = restProvider('http://api.test/v1/').for(recipes);

			await provider.getOne(context(fetch), 7);

			expect(requests).toEqual(['http://api.test/v1/recipes/7']);
		});

		it('returns the record as the backend sent it', async () => {
			const record = { id: 7, name: 'Caprese Salad' };
			const { fetch } = fakeFetch(record);

			const result = await restProvider('http://api.test').for(recipes).getOne(context(fetch), 7);

			expect(result).toEqual(record);
		});

		it.each([
			['../users/1', 'http://api.test/users/..%2Fusers%2F1'],
			['..%2Fposts%2F1', 'http://api.test/users/..%252Fposts%252F1'],
			['a/b', 'http://api.test/users/a%2Fb'],
			['a..b', 'http://api.test/users/a..b'],
			['what?admin=1', 'http://api.test/users/what%3Fadmin%3D1'],
			['#top', 'http://api.test/users/%23top'],
			['two words', 'http://api.test/users/two%20words']
		])('encodes the id %j as one path segment', async (id, url) => {
			const { fetch, requests } = fakeFetch({ id, email: 'ada@example.com' });

			await restProvider('http://api.test').for(users).getOne(context(fetch), id);

			expect(requests).toEqual([url]);
			// However the id is written, the request stays at {base}/{resource}/{one segment}.
			const path = new URL(requests[0]).pathname.split('/');
			expect(path).toHaveLength(3);
			expect(path[1]).toBe('users');
			expect(decodeURIComponent(path[2])).toBe(id);
		});

		it.each(['', '.', '..'])('requests nothing for the id %j', async (id) => {
			const { fetch, requests } = fakeFetch({ id, email: 'ada@example.com' });

			await expect(
				restProvider('http://api.test').for(users).getOne(context(fetch), id)
			).rejects.toThrow(/path segment/);
			expect(requests).toEqual([]);
		});
	});

	describe('create', () => {
		it('sends POST {base}/{resource} with the record as JSON', async () => {
			const { fetch, sent } = fakeFetch({ id: 9, name: 'Pad See Ew' }, { status: 201 });
			const provider = restProvider('http://api.test/v1/').for(recipes);

			await provider.create(context(fetch), { name: 'Pad See Ew' });

			expect(sent).toEqual([
				{
					method: 'POST',
					url: 'http://api.test/v1/recipes',
					contentType: 'application/json',
					body: { name: 'Pad See Ew' }
				}
			]);
		});

		it('returns the created record as the backend sent it', async () => {
			const record = { id: 9, name: 'Pad See Ew' };
			const { fetch } = fakeFetch(record, { status: 201 });

			const result = await restProvider('http://api.test')
				.for(recipes)
				.create(context(fetch), { name: 'Pad See Ew' });

			expect(result).toEqual(record);
		});
	});

	describe('update', () => {
		it('sends PUT {base}/{resource}/{id} with the whole editable record as JSON', async () => {
			const { fetch, sent } = fakeFetch({ id: 7, name: 'Pad Thai' });
			const provider = restProvider('http://api.test/v1/').for(recipes);

			await provider.update(context(fetch), { id: 7, data: { name: 'Pad Thai' } });

			expect(sent).toEqual([
				{
					method: 'PUT',
					url: 'http://api.test/v1/recipes/7',
					contentType: 'application/json',
					body: { name: 'Pad Thai' }
				}
			]);
		});

		it('writes the id as one encoded path segment', async () => {
			const { fetch, requests } = fakeFetch({ id: '../admins/1', email: 'ada@example.com' });

			await restProvider('http://api.test')
				.for(users)
				.update(context(fetch), { id: '../admins/1', data: { email: 'ada@example.com' } });

			expect(requests).toEqual(['http://api.test/users/..%2Fadmins%2F1']);
		});

		it('returns the saved record as the backend sent it', async () => {
			const record = { id: 7, name: 'Pad Thai' };
			const { fetch } = fakeFetch(record);

			const result = await restProvider('http://api.test')
				.for(recipes)
				.update(context(fetch), { id: 7, data: { name: 'Pad Thai' } });

			expect(result).toEqual(record);
		});
	});
});

describe('the bundled REST Provider, when the backend answers with an error status', () => {
	const calls = {
		getList: (fetch: typeof globalThis.fetch) =>
			restProvider('http://api.test')
				.for(recipes)
				.getList(context(fetch), { page: 1, perPage: 25 }),
		getOne: (fetch: typeof globalThis.fetch) =>
			restProvider('http://api.test').for(recipes).getOne(context(fetch), 7),
		create: (fetch: typeof globalThis.fetch) =>
			restProvider('http://api.test').for(recipes).create(context(fetch), { name: 'Pad See Ew' }),
		update: (fetch: typeof globalThis.fetch) =>
			restProvider('http://api.test')
				.for(recipes)
				.update(context(fetch), { id: 7, data: { name: 'Pad Thai' } })
	};

	/** The request each call makes, as an unexpected error names it for the server log. */
	const requestLines: Record<keyof typeof calls, string> = {
		getList: 'GET http://api.test/recipes',
		getOne: 'GET http://api.test/recipes/7',
		create: 'POST http://api.test/recipes',
		update: 'PUT http://api.test/recipes/7'
	};

	describe.each(Object.entries(calls))('%s', (name, call) => {
		it.each([
			[404, NotFoundError],
			[400, InvalidInputError],
			[422, InvalidInputError],
			[409, ConflictError]
		])('maps %i to the matching Provider error', async (status, expected) => {
			const { fetch } = fakeFetch({ message: 'Upstream says no' }, { status });

			await expect(call(fetch)).rejects.toBeInstanceOf(expected);
		});

		it.each([500, 401, 403, 503])('maps %i to an unexpected error', async (status) => {
			const { fetch } = fakeFetch({ message: 'Upstream exploded' }, { status });

			const failure = await call(fetch).catch((error: unknown) => error);

			expect(failure).toBeInstanceOf(Error);
			for (const known of [NotFoundError, InvalidInputError, ConflictError]) {
				expect(failure).not.toBeInstanceOf(known);
			}
			// For the server log only: the request, the status and what the backend said.
			expect((failure as Error).message).toContain(requestLines[name as keyof typeof calls]);
			expect((failure as Error).message).toContain(`failed with ${status}`);
			expect((failure as Error).message).toContain('Upstream exploded');
		});

		it("keeps the upstream URL and text out of a Provider error's message", async () => {
			const { fetch } = fakeFetch({ message: 'Row 7 missing in shard 3' }, { status: 404 });

			const failure = (await call(fetch).catch((error: unknown) => error)) as Error;

			expect(failure.message).not.toContain('api.test');
			expect(failure.message).not.toContain('shard 3');
		});
	});
});
