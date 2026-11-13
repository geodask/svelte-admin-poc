// The bundled REST Provider. It is server code: import it only from server-only modules and
// `.remote.ts` files, never from a module the browser loads.
import { z } from 'zod';
import type { ListResult, Provider } from './provider.ts';
import type { RecordOf, Resource } from './resource.ts';

const listResponse = z.union([
	z.object({ data: z.array(z.unknown()), total: z.number().int().min(0) }),
	z.object({ data: z.array(z.unknown()), hasNextPage: z.boolean() })
]);

/**
 * A Provider for a backend that speaks this convention:
 *
 * - `GET {base}/{resource}?page=&perPage=` returns `{ data, total }` or `{ data, hasNextPage }`.
 *
 * It uses only the `fetch` from its context. Records are not checked here: `serveResource`
 * parses each one with the Resource schema.
 *
 * @example
 * const api = restProvider('https://api.example.com');
 * export const { getList } = serveResource(recipes, api.for(recipes));
 */
export function restProvider(baseUrl: string) {
	const base = baseUrl.replace(/\/+$/, '');

	return {
		/** The Provider for one Resource, at `{base}/{resource.name}`. */
		for<R extends Resource>(resource: R): Provider<RecordOf<R>> {
			const collection = `${base}/${encodeURIComponent(resource.name)}`;

			return {
				async getList({ fetch }, { page, perPage }) {
					const search = new URLSearchParams({ page: String(page), perPage: String(perPage) });
					const url = `${collection}?${search}`;
					const parsed = listResponse.safeParse(await getJson(fetch, url));
					if (!parsed.success) {
						throw new Error(
							`REST Provider: GET ${url} returned neither { data, total } nor { data, hasNextPage }`
						);
					}
					return parsed.data as ListResult<RecordOf<R>>;
				}
			};
		}
	};
}

async function getJson(fetch: typeof globalThis.fetch, url: string): Promise<unknown> {
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) {
		throw new Error(`REST Provider: GET ${url} failed with ${response.status}`);
	}
	return response.json();
}
