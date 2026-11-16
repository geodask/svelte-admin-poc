// The core's server-only entry point. It imports `$app/server`, so only `.remote.ts` files and
// server-only modules may import it. The shared entry (`@svelte-admin/core`) never re-exports it.
import { command, form, getRequestEvent, query, requested } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { FieldError, NotFoundError, ProviderError } from './errors.ts';
import {
	formSchema,
	isInputSpec,
	toFormSpec,
	type CreateData,
	type EditData,
	type FormMode
} from './form-spec.ts';
import {
	decodeSegment,
	detailPathOfEditView,
	hasPathSegment,
	idFromParam,
	listPathOfCreateView,
	recordPath
} from './ids.ts';
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
 * - `update` is the edit form, likewise, redirecting to the record's detail View.
 * - `deleteOne` is a remote command, so it needs JavaScript. It takes the typed id, and after
 *   the delete refreshes the list queries the client asks for (`deleteOne(id).updates(getList)`).
 *
 * From a read or a delete, a Provider error becomes an HTTP error with its message: `NotFoundError` a 404,
 * `InvalidInputError` a 400 and `ConflictError` a 409. From a save, it keeps the user on the
 * form with what they typed, as a schema issue would: each issue of a `FieldError` shows under
 * the input its path names (or at the top of the form when it names none), and any other
 * Provider error shows its message at the top of the form. On edit, a `NotFoundError` reads
 * "This record no longer exists". Anything else a Provider throws is an unexpected error, which
 * Kit masks as a 500 (and the core's `handleError` logs). So is a record the Provider returns
 * that doesn't match the schema.
 *
 * **Where a save redirects to.** Inside a remote form, Kit's `getRequestEvent().url` is the URL
 * of the page the form was submitted from, with JavaScript (Kit sends the page's path with the
 * request) and without (the form posts to the page itself). The create View sits at
 * `{list}/new`, so the detail View is that path minus `/new`, plus the new id. `serveResource`
 * never needs the admin's base path. A create form must therefore be submitted from a page
 * whose path ends in `/new`; from any other page it is refused before the Provider is called.
 * Likewise the edit View sits at `{list}/{id}/edit`, so an edit form redirects to that path
 * minus `/edit`. It must be submitted from the edit View of the record its hidden id names;
 * from any other page it is refused before the Provider is called.
 *
 * @example
 * export const { getList, getOne, create, update, deleteOne } = serveResource(
 * 	recipes,
 * 	backend.for(recipes)
 * );
 */
export function serveResource<R extends Resource>(
	resource: R,
	provider: Provider<RecordOf<R>, IdOf<R>, CreateData<R>, EditData<R>>
) {
	const records = z.array(resource.schema);
	const save = {
		create: formSaver(resource, 'create'),
		edit: formSaver(resource, 'edit', { notFound: NO_LONGER_EXISTS })
	};

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
		const saved = await save.create(() => provider.create(providerContext(), data));
		// Like a read, a record that doesn't match the schema is an unexpected error.
		const record = resource.schema.parse(saved) as RecordOf<R>;
		const id = (record as { id: IdOf<R> }).id;

		getOne(id).set(record);
		await requested(getList, MAX_REFRESHED_LISTS).refreshAll();
		// A record whose id can't be one path segment has no detail View: land on the list.
		redirect(303, hasPathSegment(id) ? recordPath(listPath, id) : listPath);
	});

	const update = form(formSchema(resource, 'edit'), async ({ id, ...data }) => {
		// Before the Provider is called, so a form posted from the wrong page changes nothing:
		// the page must be the edit View of the record the hidden id names.
		const { pathname } = getRequestEvent().url;
		const detailPath = detailPathOfEditView(pathname);
		const param = decodeSegment(detailPath?.slice(detailPath.lastIndexOf('/') + 1) ?? '');
		if (detailPath === undefined || param === undefined || idFromParam(resource, param) !== id) {
			throw new Error(
				`An edit form for the id ${String(id)} was submitted from ${pathname}, not its edit View`
			);
		}
		const saved = await save.edit(() =>
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
		redirect(303, detailPath);
	});

	// The same id schema as `getOne`: `deleteOne('1')` is invalid input for a number id.
	const deleteOne = command(idSchema, async (id): Promise<void> => {
		await served(() => provider.deleteOne(providerContext(), id));
		await requested(getList, MAX_REFRESHED_LISTS).refreshAll();
	});

	return { getList, getOne, create, update, deleteOne };
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

/** What the edit form says when the record was deleted while it was being edited. */
const NO_LONGER_EXISTS = 'This record no longer exists';

/**
 * The runner of a save in `mode`: it runs a Provider call, turning a Provider error into form
 * issues, so the user stays on the form with what they typed. A `FieldError`'s issues go under
 * the inputs their paths name; one whose first key names no input the form shows goes to the
 * top of the form, so it is never lost. Any other Provider error is one issue at the top of the form, with its message, or
 * `notFound` for a `NotFoundError` when given.
 */
function formSaver(resource: Resource, mode: FormMode, { notFound }: { notFound?: string } = {}) {
	const inputs = new Set(
		toFormSpec(resource, mode)
			.filter(isInputSpec)
			.map((spec) => spec.key)
	);
	return async <T>(call: () => Promise<T>): Promise<T> => {
		try {
			return await call();
		} catch (failure) {
			if (failure instanceof FieldError) {
				invalid(
					...failure.issues.map(({ path, message }) => ({
						message,
						path: typeof path[0] === 'string' && inputs.has(path[0]) ? path : []
					}))
				);
			}
			if (failure instanceof NotFoundError && notFound !== undefined) invalid(notFound);
			if (failure instanceof ProviderError) invalid(failure.message);
			throw failure;
		}
	};
}

function providerContext(): ProviderContext {
	const { fetch, locals } = getRequestEvent();
	return { fetch, locals };
}
