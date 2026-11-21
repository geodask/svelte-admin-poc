import { z } from 'zod';
import { NotFoundError, ProviderError } from './errors.ts';
import { toCsv } from './csv.ts';
import { MAX_PER_PAGE, withDefaultSort } from './list-params.ts';
import type {
	ExportParams,
	ListParams,
	ListResult,
	ProviderContext,
	ResourceProvider
} from './provider.ts';
import type { ExportReport, ExportSummary } from './remote.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/** How many records an export holds at most, unless it is given another cap. */
const DEFAULT_MAX_EXPORT_ROWS = 10_000;

/** What `resourceOperations` takes besides the Resource and its Provider. */
export type ResourceOperationsOptions = {
	/** How many records an export holds at most: a whole number from 1. Defaults to 10,000. */
	maxExportRows?: number;
};

/** Why the Provider refused an operation: a `NotFoundError`, or any other Provider error. */
export type OperationFailure =
	| { kind: 'not-found'; status: 404; message: string }
	| { kind: 'provider-error'; status: Exclude<ProviderError['status'], 404>; message: string };

/** What an operation gives: its value, or why the Provider refused it. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: OperationFailure };

/**
 * A Resource's operations on its Provider, without Kit: what `serveResource` serves as its remote
 * functions. Each one takes the request's `ProviderContext` and gives an `Outcome`: its value, or
 * the Provider error it got as a failure (`not-found` for a `NotFoundError`, `provider-error` with
 * the status and message of any other). Anything else is unexpected and rejects: an error that is
 * no Provider error, a record that doesn't match the schema, or the record of another id than the
 * one asked for.
 *
 * - `getList` gives a page of records for validated list params. Asked for no sort, it asks the
 *   Provider for the Resource's `defaultSort`, so every caller gets the same order.
 * - `getOne` gives the record with the id asked for.
 * - `lookup` gives the record each id names, or `null` when there is none, for the References
 *   that point to this Resource. Each distinct id is asked for once: with the Provider's
 *   `getMany`, in one call per 100 ids, an id it doesn't return being `null`; without it, with one
 *   `getOne` per id, a `NotFoundError` being `null`. A record for an id it didn't ask for is
 *   ignored. Any other Provider error fails the whole lookup.
 * - `exportList` reads every page of the list its params name (with the default sort when they
 *   name none) and writes them as CSV (see `toCsv`), up to `maxExportRows` records. A Provider
 *   error on any page fails the whole export: there is never a partial file.
 *
 * Every record is parsed with the Resource schema, which drops any key it doesn't declare before
 * it leaves the server.
 */
export function resourceOperations<R extends Resource>(
	resource: R,
	provider: ResourceProvider<R>,
	{ maxExportRows = DEFAULT_MAX_EXPORT_ROWS }: ResourceOperationsOptions = {}
) {
	if (!Number.isInteger(maxExportRows) || maxExportRows < 1) {
		// Named after `serveResource`, which takes the option and is this module's only caller.
		throw new Error(
			`serveResource(${resource.name}): \`maxExportRows\` must be a whole number from 1, not ${maxExportRows}.`
		);
	}
	const records = z.array(resource.schema);
	const parse = (record: unknown) => resource.schema.parse(record) as RecordOf<R>;
	const listPage = async (context: ProviderContext, params: ListParams<R>) => {
		const result = await provider.getList(context, params);
		return { ...result, data: records.parse(result.data) as RecordOf<R>[] };
	};
	return {
		async getList(
			context: ProviderContext,
			params: ListParams<R>
		): Promise<Outcome<ListResult<RecordOf<R>>>> {
			return outcomeOf(() => listPage(context, withDefaultSort(params, resource)));
		},

		async getOne(context: ProviderContext, id: IdOf<R>): Promise<Outcome<RecordOf<R>>> {
			return outcomeOf(async () => {
				const record = parse(await provider.getOne(context, id));
				// Never give a different record than the one asked for, whatever the backend did with
				// the id: like a record that doesn't match the schema, that is unexpected.
				if (record.id !== id) {
					throw new Error(`The Provider for ${resource.name} returned another record for an id`);
				}
				return record;
			});
		},

		async lookup(
			context: ProviderContext,
			ids: readonly IdOf<R>[]
		): Promise<Outcome<Map<IdOf<R>, RecordOf<R> | null>>> {
			const { getMany } = provider;
			return outcomeOf(() =>
				resolveIds(
					ids,
					{
						getOne: (id) => provider.getOne(context, id),
						// Called on the Provider, as `getOne` is, so a Provider written as a class keeps its `this`.
						...(getMany && { getMany: (chunk) => getMany.call(provider, context, chunk) })
					},
					parse
				)
			);
		},

		async exportList(
			context: ProviderContext,
			params: ExportParams<R>
		): Promise<Outcome<ExportReport>> {
			const query = withDefaultSort(params, resource);
			return outcomeOf(async () => {
				const { records: exported, ...summary } = await collectPages(
					(page, perPage) => listPage(context, { ...query, page, perPage } as ListParams<R>),
					maxExportRows
				);
				return { csv: toCsv(resource, exported), rows: exported.length, ...summary };
			});
		}
	};
}

/** Run an operation, giving a Provider error as a failure. Anything else it throws, it rethrows. */
async function outcomeOf<T>(operation: () => Promise<T>): Promise<Outcome<T>> {
	try {
		return { ok: true, value: await operation() };
	} catch (thrown) {
		if (!(thrown instanceof ProviderError)) throw thrown;
		const { status, message } = thrown;
		return {
			ok: false,
			failure:
				status === 404
					? { kind: 'not-found', status, message }
					: { kind: 'provider-error', status, message }
		};
	}
}

/** Where `resolveIds` reads records from: a Provider's `getOne` and `getMany`, bound to the request. */
type IdSource<Id> = {
	/** One record by its id. It throws `NotFoundError` for an id with no record. */
	getOne(id: Id): Promise<unknown>;
	/** Optional: the records for 1 to 100 distinct ids, in any order, leaving out the missing ones. */
	getMany?(ids: Id[]): Promise<unknown[]>;
};

/** The most ids one `getMany` call is asked for. */
const MAX_GET_MANY_IDS = 100;

/**
 * The record each id names, or `null` for an id with no record. Each distinct id is asked for
 * once:
 *
 * - With `getMany`, in one call per chunk of `MAX_GET_MANY_IDS` distinct ids, all at once. An id
 *   it doesn't return a record for resolves to `null`.
 * - Without it, with `getOne` per id, all at once. A `NotFoundError` resolves its id to `null`.
 *
 * Each record is parsed with `parse` (the target's schema), and a record for an id it didn't ask
 * for is ignored, so that id resolves to `null`. Any other error fails the whole batch: it
 * rejects with that error, as a record that doesn't parse does.
 */
async function resolveIds<Id extends string | number, T extends object>(
	ids: readonly Id[],
	source: IdSource<Id>,
	parse: (record: unknown) => T
): Promise<Map<Id, T | null>> {
	const distinct = [...new Set(ids)];
	const found = new Map<Id, T>();
	const { getMany } = source;
	if (getMany) {
		const chunks: Id[][] = [];
		for (let start = 0; start < distinct.length; start += MAX_GET_MANY_IDS) {
			chunks.push(distinct.slice(start, start + MAX_GET_MANY_IDS));
		}
		const answers = await Promise.all(chunks.map((chunk) => getMany.call(source, chunk)));
		for (const record of answers.flat().map(parse)) {
			found.set((record as { id: Id }).id, record);
		}
	} else {
		await Promise.all(
			distinct.map(async (id) => {
				let answer: unknown;
				try {
					answer = await source.getOne(id);
				} catch (failure) {
					if (failure instanceof NotFoundError) return;
					throw failure;
				}
				const record = parse(answer);
				// Only the record asked for: `getOne` for 2 answering record 3 says nothing of 3.
				if ((record as { id?: unknown }).id === id) found.set(id, record);
			})
		);
	}
	// A record for an id that wasn't asked for is never read back.
	return new Map(distinct.map((id) => [id, found.get(id) ?? null]));
}

/**
 * Every record of a list, read page after page from page 1 with `getPage(page, perPage)`, up to
 * `maxRows` records. Pages hold `MAX_PER_PAGE` records, or `maxRows` when that is smaller, so it
 * never asks for more than it keeps. It stops at the last page (the `total` is reached,
 * `hasNextPage` is false, or a page comes back short) or at the cap, keeping the first `maxRows`
 * records, and says whether it stopped at the cap with more left. A page that fails fails the
 * whole collection: it rejects with that failure, and keeps nothing.
 */
async function collectPages<T>(
	getPage: (page: number, perPage: number) => Promise<ListResult<T>>,
	maxRows: number
): Promise<Omit<ExportSummary, 'rows'> & { records: T[] }> {
	const perPage = Math.min(MAX_PER_PAGE, maxRows);
	const records: T[] = [];
	let total: number | undefined;
	let more = true;
	for (let page = 1; more && records.length < maxRows; page++) {
		const result = await getPage(page, perPage);
		records.push(...result.data);
		if ('total' in result) total = result.total;
		more =
			result.data.length === perPage &&
			('total' in result ? page * perPage < result.total : result.hasNextPage);
	}
	const collected = {
		records: records.slice(0, maxRows),
		capped: records.length > maxRows || more
	};
	return total === undefined ? collected : { ...collected, total };
}
