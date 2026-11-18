// The core's server-only entry point. It imports `$app/server`, so only `.remote.ts` files and
// server-only modules may import it. The shared entry (`@svelte-admin/core`) never re-exports it.
import {
	command,
	form,
	getRequestEvent,
	query,
	requested,
	type RemoteForm,
	type RemoteFormInput
} from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { FieldError, NotFoundError, ProviderError } from './errors.ts';
import {
	formSchema,
	isInputSpec,
	toFormSpec,
	type EditData,
	type FormInput,
	type FormMode,
	type FormOutput,
	type FormValues
} from './form-spec.ts';
import {
	decodeSegment,
	detailPathOfEditView,
	hasPathSegment,
	idFromParam,
	listPathOfCreateView,
	recordPath
} from './ids.ts';
import { toCsv } from './csv.ts';
import { collectPages } from './export-pages.ts';
import { exportParamsSchema, listParamsSchema, withDefaultSort } from './list-params.ts';
import type { ListParams, ListResult, ProviderContext, ResourceProvider } from './provider.ts';
import type { DeleteManyReport, ExportReport, ServedFailure } from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';
import { describeUnexpected, UNEXPECTED_MESSAGE } from './unexpected.ts';

/** How many of the client's list queries a write refreshes at most. */
const MAX_REFRESHED_LISTS = 25;

/** How many ids one bulk delete takes at most. */
const MAX_BULK_DELETE = 1000;

/** How many records an export holds at most, unless `serveResource` is given another cap. */
const DEFAULT_MAX_EXPORT_ROWS = 10_000;

/** What `serveResource` takes besides the Resource and its Provider. */
export type ServeResourceOptions = {
	/**
	 * How many records an export holds at most: a whole number from 1. Defaults to 10,000. An
	 * export that stops at it says so.
	 */
	maxExportRows?: number;
};

/**
 * Build a Resource's remote functions from its Provider. The app's `.remote.ts` re-exports
 * them in one line and exports nothing else.
 *
 * - `getList` and `getOne` are remote queries. When `getList` is asked for no sort and the
 *   Resource has a `defaultSort`, the Provider gets that sort, so it needn't know the default.
 * - `create` is a remote form, validated with `formSchema(resource, 'create')`, which the
 *   browser also runs as its preflight. It works without JavaScript too. After a save it
 *   refreshes the list queries the client asks for and redirects with a 303 to the new record's
 *   detail View.
 * - `update` is the edit form, likewise, redirecting to the record's detail View.
 * - `deleteOne` is a remote command, so it needs JavaScript. It takes the typed id, and after
 *   the delete refreshes the list queries the client asks for (`deleteOne(id).updates(getList)`).
 * - `deleteMany` is a remote command too. It takes one to 1,000 typed ids (anything else is
 *   invalid input) and ignores duplicates. It calls the Provider's `deleteMany` when there is
 *   one; otherwise it calls `deleteOne` for each id in turn, stopping at the first failure. It
 *   reports how many ids were deleted and, when it stopped, why (a Provider error's status and
 *   message, or a logged unexpected error as a generic 500), instead of throwing, so the list
 *   queries the client asks for are refreshed either way (`deleteMany(ids).updates(getList)`).
 * - `exportList` is a remote command too, so export needs JavaScript. It takes the list params
 *   without the page and the page size (a search, a sort and filters), checked by the same rules
 *   as `getList`'s, and gets the default sort when it names no sort. It pages through the
 *   Provider's `getList` with `collectPages` (in pages of `MAX_PER_PAGE`, or of the cap when
 *   that is smaller), parsing each page with the Resource schema, until the last page (the
 *   `total` is reached, `hasNextPage` is false, or a page comes back short) or the cap: 10,000
 *   records, or the `maxExportRows` option. It returns the records as CSV (see `toCsv`), how
 *   many it holds, whether it stopped at the cap with more left, and the Provider's `total` when
 *   it gave one. A Provider error on any page fails the whole export with its status and
 *   message, as on reads; there is never a partial file.
 *
 * From a read or a delete, a Provider error becomes an HTTP error with its message:
 * `NotFoundError` a 404, `InvalidInputError` a 400 and `ConflictError` a 409. From a save, it
 * keeps the user on the form with what they typed, as a schema issue would: each issue of a
 * `FieldError` shows under the input its path names (or at the top of the form when it names
 * none), and any other Provider error shows its message at the top of the form. On edit, a `NotFoundError` reads
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
 * export const { getList, getOne, create, update, deleteOne, deleteMany, exportList } =
 * 	serveResource(recipes, backend.for(recipes));
 */
export function serveResource<R extends Resource>(
	resource: R,
	provider: ResourceProvider<R>,
	{ maxExportRows = DEFAULT_MAX_EXPORT_ROWS }: ServeResourceOptions = {}
) {
	if (!Number.isInteger(maxExportRows) || maxExportRows < 1) {
		throw new Error(
			`serveResource(${resource.name}): \`maxExportRows\` must be a whole number from 1, not ${maxExportRows}.`
		);
	}
	const records = z.array(resource.schema);
	const save = {
		create: formSaver(resource, 'create'),
		edit: formSaver(resource, 'edit', { notFound: NO_LONGER_EXISTS })
	};

	const getList = query(
		listParamsSchema(resource),
		async (params): Promise<ListResult<RecordOf<R>>> => {
			// Asked for no sort, the Provider gets the default, so every caller gets the same order.
			const sorted = withDefaultSort(params, resource);
			const result = await served(() => provider.getList(providerContext(), sorted));
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

	const create = form(kitFormSchema(resource, 'create'), async (data) => {
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

	const update = form(kitFormSchema(resource, 'edit'), async ({ id, ...data }) => {
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

	// One to 1,000 ids of the same type as `getOne`'s, each counted once, in the order sent.
	const idsSchema = z
		.array(idSchema)
		.min(1)
		.max(MAX_BULK_DELETE)
		.transform((ids) => [...new Set(ids)]);

	const deleteMany = command(idsSchema, async (ids): Promise<DeleteManyReport> => {
		let deleted = 0;
		let failure: ServedFailure | undefined;
		try {
			if (provider.deleteMany) {
				// All or nothing: the Provider either deleted them all or none.
				await provider.deleteMany(providerContext(), ids);
				deleted = ids.length;
			} else {
				for (const id of ids) {
					await provider.deleteOne(providerContext(), id);
					deleted++;
				}
			}
		} catch (thrown) {
			failure = bulkDeleteFailure(thrown, resource.name);
		}
		// Even after a failure, since some records may be gone.
		await requested(getList, MAX_REFRESHED_LISTS).refreshAll();
		return failure ? { deleted, failure } : { deleted };
	});

	const exportList = command(
		exportParamsSchema(resource),
		async (params): Promise<ExportReport> => {
			// Asked for no sort, the export gets the default, in the same order as the list View.
			const query = withDefaultSort(params, resource);
			const { records: exported, ...summary } = await collectPages(async (page, perPage) => {
				const listParams = { ...query, page, perPage } as ListParams<R>;
				// A Provider error fails the whole export, as on a read: there is no partial file.
				const result = await served(() => provider.getList(providerContext(), listParams));
				// Like `getList`, a record that doesn't match the schema is an unexpected error.
				return { ...result, data: records.parse(result.data) as RecordOf<R>[] };
			}, maxExportRows);
			return { csv: toCsv(resource, exported), rows: exported.length, ...summary };
		}
	);

	return {
		getList,
		getOne,
		// Typed from the Resource, so an app's replaced create or edit View gets typed `fields`.
		create: create as unknown as WithInput<typeof create, FormInput<R, 'create'>>,
		update: update as unknown as WithInput<typeof update, FormInput<R, 'edit'>>,
		deleteOne,
		deleteMany,
		exportList
	};
}

/**
 * A Resource's form schema as `serveResource` hands it to Kit's `form()`, with its input typed
 * loosely. Kit checks a form schema's input type for booleans that aren't optional, a check it
 * can't settle for a Resource that is still a type parameter. `FormInput` makes every boolean
 * optional (the type tests check that Kit takes `formSchema` as it is for a concrete Resource),
 * and the remote forms `serveResource` returns are typed with it.
 */
function kitFormSchema<R extends Resource, M extends FormMode>(resource: R, mode: M) {
	return formSchema(resource, mode) as StandardSchemaV1<FormValues, FormOutput<R, M>>;
}

/** A remote form typed with another input type, keeping its output. */
type WithInput<F, Input extends RemoteFormInput> =
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever its input type was
	F extends RemoteForm<any, infer Output> ? RemoteForm<Input, Output> : never;

/**
 * Why a bulk delete stopped, reported rather than thrown: a Provider error keeps its status and
 * message; anything else is logged, as the core's `handleError` would, and reads as a generic
 * 500.
 */
function bulkDeleteFailure(thrown: unknown, resourceName: string): ServedFailure {
	if (thrown instanceof ProviderError) return { status: thrown.status, message: thrown.message };
	console.error(`Bulk delete of ${resourceName} failed: ${describeUnexpected(thrown)}`);
	return { status: 500, message: UNEXPECTED_MESSAGE };
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
