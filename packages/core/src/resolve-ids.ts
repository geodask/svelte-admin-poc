import { NotFoundError } from './errors.ts';

/** Where `resolveIds` reads records from: a Provider's `getOne`, bound to the request. */
export type IdSource<Id> = {
	/** One record by its id. It throws `NotFoundError` for an id with no record. */
	getOne(id: Id): Promise<unknown>;
};

/**
 * The record each id names, or `null` for an id with no record: what `lookup` answers a batch of
 * References with. Each distinct id is asked for once, with the Provider's `getOne`, all at once.
 * A `NotFoundError` resolves its id to `null`. Each record is parsed with `parse` (the target's
 * schema), and a record for an id it didn't ask for is ignored, so that id resolves to `null`.
 * Any other error fails the whole batch: it rejects with that error, as a record that doesn't
 * parse does.
 */
export async function resolveIds<Id extends string | number, T extends object>(
	ids: readonly Id[],
	source: IdSource<Id>,
	parse: (record: unknown) => T
): Promise<Map<Id, T | null>> {
	const distinct = [...new Set(ids)];
	const records = await Promise.all(
		distinct.map(async (id): Promise<T | null> => {
			let found: unknown;
			try {
				found = await source.getOne(id);
			} catch (failure) {
				if (failure instanceof NotFoundError) return null;
				throw failure;
			}
			const record = parse(found);
			return (record as { id?: unknown }).id === id ? record : null;
		})
	);
	return new Map(distinct.map((id, index) => [id, records[index]]));
}
