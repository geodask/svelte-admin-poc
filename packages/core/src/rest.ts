// The bundled REST Provider. It is server code: import it only from server-only modules and
// `.remote.ts` files, never from a module the browser loads.
import { z } from 'zod';
import { ConflictError, InvalidInputError, NotFoundError } from './errors.ts';
import { idPathSegment } from './ids.ts';
import type { CreateData } from './form-spec.ts';
import type { ListResult, Provider } from './provider.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

const listResponse = z.union([
	z.object({ data: z.array(z.unknown()), total: z.number().int().min(0) }),
	z.object({ data: z.array(z.unknown()), hasNextPage: z.boolean() })
]);

/**
 * A Provider for a backend that speaks this convention:
 *
 * - `GET {base}/{resource}?page=&perPage=&q=` returns `{ data, total }` or
 *   `{ data, hasNextPage }`. `q` is the search, sent only when there is one.
 * - `GET {base}/{resource}/{id}` returns the record. The id is always one path segment
 *   (`idPathSegment`), so `../users/1` is asked for as `..%2Fusers%2F1`.
 * - `POST {base}/{resource}` with the record (without its id) as JSON creates it, and returns
 *   the created record, with its id (usually with a 201).
 *
 * - A failing status becomes a Provider error: 404 is `NotFoundError`, 400 and 422 are
 *   `InvalidInputError`, 409 is `ConflictError`. Any other is an unexpected error, whose message
 *   names the request, the status and the start of the body, for the server log.
 *
 * It uses only the `fetch` from its context. Records are not checked here: `serveResource`
 * parses each one with the Resource schema.
 *
 * @example
 * const backend = restProvider('https://api.example.com');
 * export const { getList, getOne } = serveResource(recipes, backend.for(recipes));
 */
export function restProvider(baseUrl: string) {
	const base = baseUrl.replace(/\/+$/, '');

	return {
		/** The Provider for one Resource, at `{base}/{resource.name}`. */
		for<R extends Resource>(resource: R): Provider<RecordOf<R>, IdOf<R>, CreateData<R>> {
			const resourceUrl = `${base}/${encodeURIComponent(resource.name)}`;

			return {
				async getList({ fetch }, { page, perPage, search }) {
					const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
					if (search !== undefined) query.set('q', search);
					const url = `${resourceUrl}?${query}`;
					const parsed = listResponse.safeParse(await requestJson(fetch, 'GET', url));
					if (!parsed.success) {
						throw new Error(
							`REST Provider: GET ${url} returned neither { data, total } nor { data, hasNextPage }`
						);
					}
					return parsed.data as ListResult<RecordOf<R>>;
				},

				async getOne({ fetch }, id) {
					const url = `${resourceUrl}/${idPathSegment(id)}`;
					return (await requestJson(fetch, 'GET', url)) as RecordOf<R>;
				},

				async create({ fetch }, data) {
					return (await requestJson(fetch, 'POST', resourceUrl, data)) as RecordOf<R>;
				}
			};
		}
	};
}

/** The Provider error each upstream status means. Any other failing status is unexpected. */
const statusErrors: Record<number, new () => Error> = {
	400: InvalidInputError,
	404: NotFoundError,
	409: ConflictError,
	422: InvalidInputError
};

/** How much of a failing response's body an unexpected error keeps, for the server log. */
const MAX_BODY_IN_LOG = 500;

/** Send a request, with `body` as JSON when there is one, and read the JSON response. */
async function requestJson(
	fetch: typeof globalThis.fetch,
	method: 'GET' | 'POST',
	url: string,
	body?: unknown
): Promise<unknown> {
	const response = await fetch(url, {
		method,
		headers:
			body === undefined
				? { accept: 'application/json' }
				: { accept: 'application/json', 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	if (!response.ok) {
		// A Provider error's message reaches the user, so it keeps its safe default.
		const KnownError = statusErrors[response.status];
		if (KnownError) throw new KnownError();
		// An unexpected error is only logged, so it says what happened upstream.
		const said = (await response.text().catch(() => '')).slice(0, MAX_BODY_IN_LOG);
		throw new Error(
			`REST Provider: ${method} ${url} failed with ${response.status}${said ? `: ${said}` : ''}`
		);
	}
	return response.json();
}
