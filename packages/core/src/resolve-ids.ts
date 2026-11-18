import { NotFoundError } from './errors.ts';

/** Where `resolveIds` reads records from: a Provider's `getOne` and `getMany`, bound to the request. */
export type IdSource<Id> = {
	/** One record by its id. It throws `NotFoundError` for an id with no record. */
	getOne(id: Id): Promise<unknown>;
	/** Optional: the records for 1 to 100 distinct ids, in any order, leaving out the missing ones. */
	getMany?(ids: Id[]): Promise<unknown[]>;
};

/** The most ids one `getMany` call is asked for. */
const MAX_GET_MANY_IDS = 100;

/**
 * The record each id names, or `null` for an id with no record: what `lookup` answers a batch of
 * References with. Each distinct id is asked for once:
 *
 * - With `getMany`, in one call per chunk of `MAX_GET_MANY_IDS` distinct ids, all at once. An id
 *   it doesn't return a record for resolves to `null`.
 * - Without it, with `getOne` per id, all at once. A `NotFoundError` resolves its id to `null`.
 *
 * Each record is parsed with `parse` (the target's schema), and a record for an id it didn't ask
 * for is ignored, so that id resolves to `null`. Any other error fails the whole batch: it
 * rejects with that error, as a record that doesn't parse does.
 */
export async function resolveIds<Id extends string | number, T extends object>(
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
