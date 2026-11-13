// PROTOTYPE (PER-18) — core, server-only. Builds a Resource's remote functions from its Provider.
import { command, query, getRequestEvent, requested } from '$app/server';
import { z } from 'zod';
import type { Resource } from './resource';
import type { ListParams, Provider, ProviderContext } from './provider';

function ctx(): ProviderContext {
	const { fetch, locals } = getRequestEvent();
	return { fetch, locals };
}

const ListParamsSchema = z.object({
	page: z.number().int().min(1),
	perPage: z.number().int().min(1).max(100),
	sort: z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) }).optional(),
	search: z.string().optional(),
	filters: z.array(z.object({ field: z.string(), value: z.string() }))
});

export function serveResource<S extends z.ZodObject>(
	resource: Resource<S>,
	provider: Provider<z.infer<S>, any>
) {
	const getList = query(ListParamsSchema, (p) => provider.getList(ctx(), p as ListParams));

	const deleteMany = command(z.array(z.number()), async (ids) => {
		await provider.deleteMany!(ctx(), ids);
		// the client said which list instances it shows; refresh them in the same response
		await requested(getList, 5).refreshAll();
	});

	return { getList, deleteMany };
}

export type ResourceRemote = ReturnType<typeof serveResource>;
