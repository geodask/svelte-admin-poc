// The core's server-only entry point. It imports `$app/server`, so only `.remote.ts` files and
// server-only modules may import it. The shared entry (`@svelte-admin/core`) never re-exports it.
import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { ProviderError } from './errors.ts';
import { listParamsSchema } from './list-params.ts';
import type { ListResult, Provider, ProviderContext } from './provider.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * Build a Resource's remote functions from its Provider. The app's `.remote.ts` re-exports
 * them in one line and exports nothing else.
 *
 * A Provider error becomes an HTTP error with its message: `NotFoundError` a 404,
 * `InvalidInputError` a 400 and `ConflictError` a 409. Anything else it throws is an unexpected
 * error, which Kit masks as a 500 (and the core's `handleError` logs).
 *
 * @example
 * export const { getList, getOne } = serveResource(recipes, backend.for(recipes));
 */
export function serveResource<R extends Resource>(
	resource: R,
	provider: Provider<RecordOf<R>, IdOf<R>>
) {
	const records = z.array(resource.schema);

	const getList = query(
		listParamsSchema(resource),
		async (params): Promise<ListResult<RecordOf<R>>> => {
			const result = await served(() => provider.getList(providerContext(), params));
			// A record that doesn't match the schema is an unexpected error, masked as a 500.
			// Parsing also drops any key the schema doesn't declare before it reaches the browser.
			return { ...result, data: records.parse(result.data) as RecordOf<R>[] };
		}
	);

	// The id schema never coerces, so `getOne('1')` is invalid input for a number id, not record 1.
	const idSchema = resource.schema.shape.id as z.ZodType<IdOf<R>, IdOf<R>>;

	const getOne = query(idSchema, async (id): Promise<RecordOf<R>> => {
		const record = resource.schema.parse(
			await served(() => provider.getOne(providerContext(), id))
		);
		// Never serve a different record than the one asked for, whatever the backend did with
		// the id: like a record that doesn't match the schema, that is an unexpected error.
		if (record.id !== id) {
			throw new Error(`The Provider for ${resource.name} returned another record for an id`);
		}
		return record as RecordOf<R>;
	});

	return { getList, getOne };
}

/** Run a Provider call, turning a Provider error into the HTTP error with its status. */
async function served<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (failure) {
		if (failure instanceof ProviderError) error(failure.status, failure.message);
		throw failure;
	}
}

function providerContext(): ProviderContext {
	const { fetch, locals } = getRequestEvent();
	return { fetch, locals };
}
