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

describe('resolving ids with a Provider without getMany: getOne per id', () => {
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

/**
 * A fake backend with `getMany` over `records`, recording each call's ids. It returns the records
 * it has, in reverse order, leaving out the missing ones, unless `answer` says what to return.
 */
function batchBackend(records: User[], answer?: (ids: number[]) => unknown[]) {
	const calls: number[][] = [];
	const askedOne: number[] = [];
	const source = {
		getOne: async (id: number): Promise<unknown> => {
			askedOne.push(id);
			throw new Error('getOne should not be called when getMany is there');
		},
		getMany: async (ids: number[]): Promise<unknown[]> => {
			calls.push(ids);
			if (answer) return answer(ids);
			return records.filter((record) => ids.includes(record.id)).toReversed();
		}
	};
	return { calls, askedOne, source };
}

describe('resolving ids with a Provider that has getMany', () => {
	it('asks for every id in one call and gives each id its record', async () => {
		const { calls, askedOne, source } = batchBackend([ada, grace]);

		const resolved = await resolveIds([1, 2], source, parse);

		expect(calls).toEqual([[1, 2]]);
		expect(askedOne).toEqual([]);
		expect(resolved).toEqual(
			new Map([
				[1, ada],
				[2, grace]
			])
		);
	});

	it('asks for at most 100 ids per call, one call per chunk', async () => {
		const many = Array.from({ length: 250 }, (_, index) => ({
			id: index + 1,
			name: `User ${index + 1}`
		}));
		const { calls, source } = batchBackend(many);

		const resolved = await resolveIds(
			many.map((user) => user.id),
			source,
			parse
		);

		expect(calls.map((ids) => ids.length)).toEqual([100, 100, 50]);
		expect(calls.flat()).toEqual(many.map((user) => user.id));
		expect(resolved.size).toBe(250);
		expect(resolved.get(250)).toEqual({ id: 250, name: 'User 250' });
	});

	it('asks for each distinct id once', async () => {
		const { calls, source } = batchBackend([ada, grace]);

		const resolved = await resolveIds([2, 1, 2, 2, 1], source, parse);

		expect(calls).toEqual([[2, 1]]);
		expect([...resolved.keys()]).toEqual([2, 1]);
	});

	it('asks for nothing when there are no ids', async () => {
		const { calls, source } = batchBackend([ada]);

		expect(await resolveIds([], source, parse)).toEqual(new Map());
		expect(calls).toEqual([]);
	});

	it('resolves an id it did not get back to null, without calling getOne', async () => {
		const { askedOne, source } = batchBackend([ada]);

		const resolved = await resolveIds([1, 7], source, parse);

		expect(resolved).toEqual(
			new Map([
				[1, ada],
				[7, null]
			])
		);
		expect(askedOne).toEqual([]);
	});

	it('ignores a record for an id it did not ask for', async () => {
		const { source } = batchBackend([], () => [ada, { id: 3, name: 'Alan Turing' }]);

		const resolved = await resolveIds([1, 2], source, parse);

		expect(resolved).toEqual(
			new Map([
				[1, ada],
				[2, null]
			])
		);
	});

	it('drops what the schema does not declare', async () => {
		const { source } = batchBackend([], () => [{ ...ada, password: 'secret' }]);

		expect((await resolveIds([1], source, parse)).get(1)).toEqual(ada);
	});

	it('fails the whole batch on a Provider error, with that error', async () => {
		const conflict = new ConflictError('Locked');
		const { source } = batchBackend([], () => {
			throw conflict;
		});

		await expect(resolveIds([1, 2], source, parse)).rejects.toBe(conflict);
	});

	it('fails the whole batch on a record that does not match the schema', async () => {
		const { source } = batchBackend([], () => [ada, { id: 2 }]);

		await expect(resolveIds([1, 2], source, parse)).rejects.toThrow();
	});
});
