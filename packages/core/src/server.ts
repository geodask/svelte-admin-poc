// The core's server-only entry point. It imports `$app/server`, so only `.remote.ts` files and
// server-only modules may import it. The shared entry (`@svelte-admin/core`) never re-exports it.
import { getRequestEvent, query } from '$app/server';
import { z } from 'zod';
import { listParamsSchema } from './list-params.ts';
import type { ListResult, Provider, ProviderContext } from './provider.ts';
import type { RecordOf, Resource } from './resource.ts';

/**
 * Build a Resource's remote functions from its Provider. The app's `.remote.ts` re-exports
 * them in one line and exports nothing else:
 *
 * @example
 * export const { getList } = serveResource(recipes, backend.for(recipes));
 */
export function serveResource<R extends Resource>(resource: R, provider: Provider<RecordOf<R>>) {
	const records = z.array(resource.schema);

	const getList = query(listParamsSchema, async (params): Promise<ListResult<RecordOf<R>>> => {
		const result = await provider.getList(providerContext(), params);
		// A record that doesn't match the schema is an unexpected error, masked as a 500.
		// Parsing also drops any key the schema doesn't declare before it reaches the browser.
		return { ...result, data: records.parse(result.data) as RecordOf<R>[] };
	});

	return { getList };
}

function providerContext(): ProviderContext {
	const { fetch, locals } = getRequestEvent();
	return { fetch, locals };
}
