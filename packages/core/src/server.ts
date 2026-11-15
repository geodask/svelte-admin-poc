// The core's server-only entry point. It imports `$app/server`, so only `.remote.ts` files and
// server-only modules may import it. The shared entry (`@svelte-admin/core`) never re-exports it.
import { form, getRequestEvent, query, requested } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { ProviderError } from './errors.ts';
import { formSchema, type CreateData, type EditData } from './form-spec.ts';
import { hasPathSegment, idPathSegment, listPathOfCreateView, listPathOfEditView } from './ids.ts';
import { listParamsSchema } from './list-params.ts';
import type { ListResult, Provider, ProviderContext } from './provider.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/** How many of the client's list queries a write refreshes at most. */
const MAX_REFRESHED_LISTS = 25;

/**
 * Build a Resource's remote functions from its Provider. The app's `.remote.ts` re-exports
 * them in one line and exports nothing else.
 *
 * - `getList` and `getOne` are remote queries.
 * - `create` is a remote form, validated with `formSchema(resource, 'create')`, which the
 *   browser also runs as its preflight. It works without JavaScript too. After a save it
 *   refreshes the list queries the client asks for and redirects with a 303 to the new record's
 *   detail View.
 *
 * A Provider error becomes an HTTP error with its message: `NotFoundError` a 404,
 * `InvalidInputError` a 400 and `ConflictError` a 409. Anything else it throws is an unexpected
 * error, which Kit masks as a 500 (and the core's `handleError` logs). So is a record the
 * Provider returns that doesn't match the schema.
 *
 * **Where a save redirects to.** Inside a remote form, Kit's `getRequestEvent().url` is the URL
 * of the page the form was submitted from, with JavaScript (Kit sends the page's path with the
 * request) and without (the form posts to the page itself). The create View sits at
 * `{list}/new`, so the detail View is that path minus `/new`, plus the new id. `serveResource`
 * never needs the admin's base path. A create form must therefore be submitted from a page
 * whose path ends in `/new`; from any other page it is refused before the Provider is called.
 * Likewise the edit View sits at `{list}/{id}/edit`, so an edit form must be submitted from a
 * page whose path ends in `/edit`, and redirects to `{list}/{id}`.
 *
 * @example
 * export const { getList, getOne, create, update } = serveResource(recipes, backend.for(recipes));
 */
export function serveResource<R extends Resource>(
	resource: R,
	provider: Provider<RecordOf<R>, IdOf<R>, CreateData<R>, EditData<R>>
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

	const create = form(formSchema(resource, 'create'), async (data) => {
		// Before the Provider is called, so a form posted from the wrong page creates nothing.
		const { pathname } = getRequestEvent().url;
		const listPath = listPathOfCreateView(pathname);
		if (listPath === undefined) {
			throw new Error(`A create form was submitted from ${pathname}, which is no create View`);
		}
		const saved = await served(() => provider.create(providerContext(), data));
		// Like a read, a record that doesn't match the schema is an unexpected error.
		const record = resource.schema.parse(saved) as RecordOf<R>;
		const id = (record as { id: IdOf<R> }).id;

		getOne(id).set(record);
		await requested(getList, MAX_REFRESHED_LISTS).refreshAll();
		// A record whose id can't be one path segment has no detail View: land on the list.
		redirect(303, hasPathSegment(id) ? `${listPath}/${idPathSegment(id)}` : listPath);
	});

	const update = form(formSchema(resource, 'edit'), async ({ id, ...data }) => {
		// Before the Provider is called, so a form posted from the wrong page changes nothing.
		const { pathname } = getRequestEvent().url;
		const listPath = listPathOfEditView(pathname);
		if (listPath === undefined) {
			throw new Error(`An edit form was submitted from ${pathname}, which is no edit View`);
		}
		const saved = await served(() =>
			provider.update(providerContext(), { id, data: data as EditData<R> })
		);
		// Like a read, a record that doesn't match the schema, or another record than the one
		// edited, is an unexpected error.
		const record = resource.schema.parse(saved) as RecordOf<R>;
		if (record.id !== id) {
			throw new Error(`The Provider for ${resource.name} returned another record from update`);
		}

		getOne(id).set(record);
		await requested(getList, MAX_REFRESHED_LISTS).refreshAll();
		redirect(303, `${listPath}/${idPathSegment(id)}`);
	});

	return { getList, getOne, create, update };
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
