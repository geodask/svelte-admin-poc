import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConflictError, NotFoundError } from '@svelte-admin/core';
import { resolveIds } from '@svelte-admin/core/lookup';

type User = { id: number; name: string };

const schema = z.object({ id: z.number(), name: z.string() });
const parse = (record: unknown): User => schema.parse(record);

/**
 * A fake backend's `getOne` over `records`, recording each id it is asked for. An id it has no
 * record for is a `NotFoundError`, unless `answers` says what to do for it.
 */
function backend(records: User[], answers: Record<number, () => unknown> = {}) {
	const asked: number[] = [];
	const getOne = async (id: number): Promise<unknown> => {
		asked.push(id);
		const answer = answers[id];
		if (answer !== undefined) return answer();
		const record = records.find((candidate) => candidate.id === id);
		if (record === undefined) throw new NotFoundError();
		return record;
	};
	return { asked, source: { getOne } };
}

const ada = { id: 1, name: 'Ada Lovelace' };
const grace = { id: 2, name: 'Grace Hopper' };

describe('resolving the ids a page of References names', () => {
	it('gives each id its record', async () => {
		const { source } = backend([ada, grace]);

		const resolved = await resolveIds([1, 2], source, parse);

		expect(resolved).toEqual(
			new Map([
				[1, ada],
				[2, grace]
			])
		);
	});

	it('asks for each distinct id once', async () => {
		const { asked, source } = backend([ada, grace]);

		const resolved = await resolveIds([2, 1, 2, 2, 1], source, parse);

		expect(asked.toSorted()).toEqual([1, 2]);
		expect([...resolved.keys()]).toEqual([2, 1]);
	});

	it('asks for nothing when there are no ids', async () => {
		const { asked, source } = backend([ada]);

		expect(await resolveIds([], source, parse)).toEqual(new Map());
		expect(asked).toEqual([]);
	});

	it('resolves an id the Provider has no record for (NotFoundError) to null', async () => {
		const { source } = backend([ada]);

		const resolved = await resolveIds([1, 7], source, parse);

		expect(resolved.get(1)).toEqual(ada);
		expect(resolved.get(7)).toBeNull();
	});

	it('ignores a record for an id it did not ask for, so that id resolves to null', async () => {
		const { source } = backend([ada], { 2: () => ({ id: 3, name: 'Alan Turing' }) });

		const resolved = await resolveIds([1, 2], source, parse);

		expect(resolved).toEqual(
			new Map([
				[1, ada],
				[2, null]
			])
		);
	});

	it('drops what the schema does not declare, as getOne does', async () => {
		const { source } = backend([], { 1: () => ({ ...ada, password: 'secret' }) });

		expect((await resolveIds([1], source, parse)).get(1)).toEqual(ada);
	});

	it('fails the whole batch on any other Provider error, with that error', async () => {
		const conflict = new ConflictError('Locked');
		const { source } = backend([ada], {
			2: () => {
				throw conflict;
			}
		});

		await expect(resolveIds([1, 2], source, parse)).rejects.toBe(conflict);
	});

	it('fails the whole batch on an unexpected error', async () => {
		const { source } = backend([ada], {
			2: () => {
				throw new Error('socket hang up');
			}
		});

		await expect(resolveIds([1, 2], source, parse)).rejects.toThrow('socket hang up');
	});

	it('fails the whole batch on a record that does not match the schema', async () => {
		const { source } = backend([ada], { 2: () => ({ id: 2 }) });

		await expect(resolveIds([1, 2], source, parse)).rejects.toThrow();
	});
});
