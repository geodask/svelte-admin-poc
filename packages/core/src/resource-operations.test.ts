import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	field,
	ConflictError,
	InvalidInputError,
	NotFoundError,
	MAX_PER_PAGE,
	type ListParams,
	type ListResult,
	type ProviderContext,
	type Resource,
	type ResourceProvider
} from '@svelte-admin/core';
import { resourceOperations } from './resource-operations.ts';

const context: ProviderContext = { fetch: globalThis.fetch, locals: {} };

type Row = Record<string, unknown> & { id: string | number };

/**
 * An in-memory Provider over `rows`, recording the list params and the ids it is given. Its
 * `getList` pages through the rows in order and answers with a `total`, or with `hasNextPage`
 * when `answer` says so. Its `getOne` throws `NotFoundError` for an id it has no row for, unless
 * `getOneAnswers` says what to do for that id.
 */
function memoryProvider<R extends Resource>(
	rows: readonly Row[],
	{
		answer = 'total',
		getOneAnswers = {},
		getMany
	}: {
		/** How `getList` answers: with a `total`, with `hasNextPage`, or as the function says. */
		answer?: 'total' | 'hasNextPage' | ((params: ListParams) => ListResult<Row>);
		getOneAnswers?: Record<string | number, () => unknown>;
		/**
		 * Gives the Provider a `getMany`: `true` for one that returns the rows it has, in reverse
		 * order, leaving out the missing ones, or a function that says what it returns.
		 */
		getMany?: true | ((ids: (string | number)[]) => unknown[]);
	} = {}
) {
	const listed: ListParams[] = [];
	const askedOne: (string | number)[] = [];
	const askedMany: (string | number)[][] = [];
	const many = async (_ctx: ProviderContext, ids: (string | number)[]): Promise<unknown[]> => {
		askedMany.push(ids);
		if (typeof getMany === 'function') return getMany(ids);
		return rows.filter((row) => ids.includes(row.id)).toReversed();
	};
	const provider = {
		...(getMany && { getMany: many }),
		async getList(_ctx: ProviderContext, params: ListParams): Promise<ListResult<Row>> {
			listed.push(params);
			if (typeof answer === 'function') return answer(params);
			const start = (params.page - 1) * params.perPage;
			const data = rows.slice(start, start + params.perPage);
			return answer === 'total'
				? { data, total: rows.length }
				: { data, hasNextPage: start + params.perPage < rows.length };
		},
		async getOne(_ctx: ProviderContext, id: string | number): Promise<unknown> {
			askedOne.push(id);
			const special = getOneAnswers[id];
			if (special !== undefined) return special();
			const row = rows.find((candidate) => candidate.id === id);
			if (row === undefined) throw new NotFoundError('No such note');
			return row;
		},
		async create() {
			throw new Error('not used');
		},
		async update() {
			throw new Error('not used');
		},
		async deleteOne() {
			throw new Error('not used');
		}
	};
	return { listed, askedOne, askedMany, provider: provider as unknown as ResourceProvider<R> };
}

/** A Provider whose every call throws `failure`. */
function failingProvider<R extends Resource>(failure: unknown): ResourceProvider<R> {
	const fail = async () => {
		throw failure;
	};
	return {
		getList: fail,
		getOne: fail,
		getMany: fail,
		create: fail,
		update: fail,
		deleteOne: fail,
		deleteMany: fail
	};
}

const notes = defineResource({
	name: 'notes',
	label: 'Notes',
	schema: z.object({ id: z.number(), text: field(z.string(), { sortable: true }) }),
	defaultSort: { field: 'text', order: 'asc' }
});

describe('listing a page of records', () => {
	it('gives the Provider’s page of records', async () => {
		const { provider } = memoryProvider<typeof notes>([
			{ id: 1, text: 'Ramen' },
			{ id: 2, text: 'Pad Thai' },
			{ id: 3, text: 'Pho' }
		]);

		const outcome = await resourceOperations(notes, provider).getList(context, {
			page: 2,
			perPage: 2
		});

		expect(outcome).toEqual({ ok: true, value: { data: [{ id: 3, text: 'Pho' }], total: 3 } });
	});

	it('asks the Provider for the Resource’s default sort when the params name none', async () => {
		const { listed, provider } = memoryProvider<typeof notes>([]);
		const operations = resourceOperations(notes, provider);

		await operations.getList(context, { page: 1, perPage: 25 });
		await operations.getList(context, {
			page: 1,
			perPage: 25,
			sort: { field: 'text', order: 'desc' }
		});

		expect(listed.map((params) => params.sort)).toEqual([
			{ field: 'text', order: 'asc' },
			{ field: 'text', order: 'desc' }
		]);
	});

	it('rejects a page with a record that doesn’t match the schema, and drops what it doesn’t declare', async () => {
		const { provider } = memoryProvider<typeof notes>([{ id: 1, text: 'Ramen', secret: 'x' }]);
		const { provider: broken } = memoryProvider<typeof notes>([{ id: 1 }]);

		expect(
			await resourceOperations(notes, provider).getList(context, { page: 1, perPage: 25 })
		).toEqual({
			ok: true,
			value: { data: [{ id: 1, text: 'Ramen' }], total: 1 }
		});
		await expect(
			resourceOperations(notes, broken).getList(context, { page: 1, perPage: 25 })
		).rejects.toThrow();
	});

	it('gives a Provider error as a failure with its status and message', async () => {
		const provider = failingProvider<typeof notes>(new InvalidInputError('Bad filter'));

		const outcome = await resourceOperations(notes, provider).getList(context, {
			page: 1,
			perPage: 25
		});

		expect(outcome).toEqual({
			ok: false,
			failure: { reason: 'provider-error', status: 400, message: 'Bad filter' }
		});
	});
});

describe('getting one record', () => {
	const ramen = { id: 1, text: 'Ramen' };

	it('gives the record with the id asked for', async () => {
		const { provider } = memoryProvider<typeof notes>([ramen, { id: 2, text: 'Pho' }]);

		expect(await resourceOperations(notes, provider).getOne(context, 1)).toEqual({
			ok: true,
			value: ramen
		});
	});

	it('gives "not found" for a record that doesn’t exist', async () => {
		const { provider } = memoryProvider<typeof notes>([ramen]);

		expect(await resourceOperations(notes, provider).getOne(context, 7)).toEqual({
			ok: false,
			failure: { reason: 'not-found', status: 404, message: 'No such note' }
		});
	});

	it('rejects a record with another id than the one asked for, as unexpected', async () => {
		const { provider } = memoryProvider<typeof notes>([], { getOneAnswers: { 2: () => ramen } });

		await expect(resourceOperations(notes, provider).getOne(context, 2)).rejects.toThrow(
			'The Provider for notes returned another record for an id'
		);
	});

	it('gives any other Provider error as a failure with its status and message', async () => {
		const provider = failingProvider<typeof notes>(new ConflictError('Locked'));

		expect(await resourceOperations(notes, provider).getOne(context, 1)).toEqual({
			ok: false,
			failure: { reason: 'provider-error', status: 409, message: 'Locked' }
		});
	});

	it('rejects with anything else the Provider throws', async () => {
		const provider = failingProvider<typeof notes>(new Error('socket hang up'));

		await expect(resourceOperations(notes, provider).getOne(context, 1)).rejects.toThrow(
			'socket hang up'
		);
	});

	it('rejects a record that doesn’t match the schema, and drops what it doesn’t declare', async () => {
		const { provider } = memoryProvider<typeof notes>([], {
			getOneAnswers: { 1: () => ({ ...ramen, secret: 'x' }), 2: () => ({ id: 2 }) }
		});
		const operations = resourceOperations(notes, provider);

		expect(await operations.getOne(context, 1)).toEqual({ ok: true, value: ramen });
		await expect(operations.getOne(context, 2)).rejects.toThrow();
	});
});

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

const ada = { id: 1, name: 'Ada Lovelace' };
const grace = { id: 2, name: 'Grace Hopper' };

describe('looking up records by id for References, with a Provider without getMany', () => {
	it('gives each id its record, asking getOne for each distinct id once', async () => {
		const { askedOne, provider } = memoryProvider<typeof users>([ada, grace]);

		const outcome = await resourceOperations(users, provider).lookup(context, [2, 1, 2, 2, 1]);

		expect(outcome).toEqual({
			ok: true,
			value: new Map([
				[2, grace],
				[1, ada]
			])
		});
		expect(askedOne.toSorted()).toEqual([1, 2]);
	});

	it('asks for nothing when there are no ids', async () => {
		const { askedOne, provider } = memoryProvider<typeof users>([ada]);

		expect(await resourceOperations(users, provider).lookup(context, [])).toEqual({
			ok: true,
			value: new Map()
		});
		expect(askedOne).toEqual([]);
	});

	it('gives null for an id the Provider has no record for (NotFoundError)', async () => {
		const { provider } = memoryProvider<typeof users>([ada]);

		expect(await resourceOperations(users, provider).lookup(context, [1, 7])).toEqual({
			ok: true,
			value: new Map([
				[1, ada],
				[7, null]
			])
		});
	});

	it('gives null for an id whose answer is a record with another id', async () => {
		const { provider } = memoryProvider<typeof users>([ada], {
			getOneAnswers: { 2: () => ({ id: 3, name: 'Alan Turing' }) }
		});

		expect(await resourceOperations(users, provider).lookup(context, [1, 2])).toEqual({
			ok: true,
			value: new Map([
				[1, ada],
				[2, null]
			])
		});
	});

	it('drops what the schema doesn’t declare, as getOne does', async () => {
		const { provider } = memoryProvider<typeof users>([], {
			getOneAnswers: { 1: () => ({ ...ada, password: 'secret' }) }
		});

		expect(await resourceOperations(users, provider).lookup(context, [1])).toEqual({
			ok: true,
			value: new Map([[1, ada]])
		});
	});

	it('fails the whole batch on any other Provider error, with its status and message', async () => {
		const { provider } = memoryProvider<typeof users>([ada], {
			getOneAnswers: {
				2: () => {
					throw new ConflictError('Locked');
				}
			}
		});

		expect(await resourceOperations(users, provider).lookup(context, [1, 2])).toEqual({
			ok: false,
			failure: { reason: 'provider-error', status: 409, message: 'Locked' }
		});
	});

	it('rejects the whole batch on an unexpected error, or a record that doesn’t match the schema', async () => {
		const { provider } = memoryProvider<typeof users>([ada], {
			getOneAnswers: {
				2: () => {
					throw new Error('socket hang up');
				},
				3: () => ({ id: 3 })
			}
		});
		const operations = resourceOperations(users, provider);

		await expect(operations.lookup(context, [1, 2])).rejects.toThrow('socket hang up');
		await expect(operations.lookup(context, [1, 3])).rejects.toThrow();
	});
});

describe('looking up records by id for References, with a Provider that has getMany', () => {
	it('asks for every distinct id once, in one getMany call, and never calls getOne', async () => {
		const { askedOne, askedMany, provider } = memoryProvider<typeof users>([ada, grace], {
			getMany: true
		});

		const outcome = await resourceOperations(users, provider).lookup(context, [2, 1, 2, 2, 1]);

		expect(outcome).toEqual({
			ok: true,
			value: new Map([
				[2, grace],
				[1, ada]
			])
		});
		expect(askedMany).toEqual([[2, 1]]);
		expect(askedOne).toEqual([]);
	});

	it('asks for at most 100 ids per call, one call per chunk', async () => {
		const everyone = Array.from({ length: 250 }, (_, index) => ({
			id: index + 1,
			name: `User ${index + 1}`
		}));
		const { askedMany, provider } = memoryProvider<typeof users>(everyone, { getMany: true });

		const outcome = await resourceOperations(users, provider).lookup(
			context,
			everyone.map((user) => user.id)
		);

		expect(askedMany.map((ids) => ids.length)).toEqual([100, 100, 50]);
		expect(askedMany.flat()).toEqual(everyone.map((user) => user.id));
		expect(outcome.ok && outcome.value.size).toBe(250);
		expect(outcome.ok && outcome.value.get(250)).toEqual({ id: 250, name: 'User 250' });
	});

	it('asks for nothing when there are no ids', async () => {
		const { askedMany, provider } = memoryProvider<typeof users>([ada], { getMany: true });

		await resourceOperations(users, provider).lookup(context, []);

		expect(askedMany).toEqual([]);
	});

	it('gives null for an id it didn’t get back, without calling getOne', async () => {
		const { askedOne, provider } = memoryProvider<typeof users>([ada], { getMany: true });

		expect(await resourceOperations(users, provider).lookup(context, [1, 7])).toEqual({
			ok: true,
			value: new Map([
				[1, ada],
				[7, null]
			])
		});
		expect(askedOne).toEqual([]);
	});

	it('ignores a record for an id it didn’t ask for, and drops what the schema doesn’t declare', async () => {
		const { provider } = memoryProvider<typeof users>([], {
			getMany: () => [
				{ ...ada, password: 'secret' },
				{ id: 3, name: 'Alan Turing' }
			]
		});

		expect(await resourceOperations(users, provider).lookup(context, [1, 2])).toEqual({
			ok: true,
			value: new Map([
				[1, ada],
				[2, null]
			])
		});
	});

	it('fails the whole batch on a Provider error, with its status and message', async () => {
		const { provider } = memoryProvider<typeof users>([], {
			getMany: () => {
				throw new ConflictError('Locked');
			}
		});

		expect(await resourceOperations(users, provider).lookup(context, [1, 2])).toEqual({
			ok: false,
			failure: { reason: 'provider-error', status: 409, message: 'Locked' }
		});
	});

	it('rejects the whole batch on a record that doesn’t match the schema', async () => {
		const { provider } = memoryProvider<typeof users>([], { getMany: () => [ada, { id: 2 }] });

		await expect(resourceOperations(users, provider).lookup(context, [1, 2])).rejects.toThrow();
	});

	it('calls getMany on the Provider, so a Provider written as a class keeps its `this`', async () => {
		class UsersProvider {
			readonly rows = [ada, grace];
			async getList() {
				return { data: this.rows, total: this.rows.length };
			}
			async getOne(): Promise<never> {
				throw new Error('getOne should not be called when getMany is there');
			}
			async getMany(_ctx: ProviderContext, ids: number[]) {
				return this.rows.filter((row) => ids.includes(row.id));
			}
			async create(): Promise<never> {
				throw new Error('not used');
			}
			async update(): Promise<never> {
				throw new Error('not used');
			}
			async deleteOne() {}
		}

		const outcome = await resourceOperations(users, new UsersProvider()).lookup(context, [2]);

		expect(outcome).toEqual({ ok: true, value: new Map([[2, grace]]) });
	});
});

const BOM = '\uFEFF';

/** The CSV's lines without the byte order mark and the final CRLF. */
const lines = (csv: string) => csv.slice(BOM.length).replace(/\r\n$/, '').split('\r\n');

describe('exporting the current list as CSV', () => {
	it('reads every page in the Resource’s default sort and writes them as one guarded CSV', async () => {
		const rows = Array.from({ length: 230 }, (_, index) => ({
			id: index + 1,
			text: index === 0 ? '=HYPERLINK("http://evil")' : `Note ${index + 1}`
		}));
		const { listed, provider } = memoryProvider<typeof notes>(rows);

		const outcome = await resourceOperations(notes, provider).exportList(context, {});

		expect(listed).toEqual([
			{ page: 1, perPage: MAX_PER_PAGE, sort: { field: 'text', order: 'asc' } },
			{ page: 2, perPage: MAX_PER_PAGE, sort: { field: 'text', order: 'asc' } },
			{ page: 3, perPage: MAX_PER_PAGE, sort: { field: 'text', order: 'asc' } }
		]);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		const { csv, ...summary } = outcome.value;
		expect(summary).toEqual({ rows: 230, capped: false, total: 230 });
		const written = lines(csv);
		expect(written).toHaveLength(231);
		expect(written.slice(0, 3)).toEqual([
			'"ID","Text"',
			'"1","\'=HYPERLINK(""http://evil"")"',
			'"2","Note 2"'
		]);
		expect(written[230]).toBe('"230","Note 230"');
	});

	it('keeps the sort, the search and the filters it is given', async () => {
		const recipes = defineResource({
			name: 'recipes',
			label: 'Recipes',
			searchable: true,
			schema: z.object({
				id: z.number(),
				name: field(z.string(), { sortable: true }),
				vegan: field(z.boolean(), { filterable: true })
			}),
			defaultSort: { field: 'name', order: 'asc' }
		});
		const { listed, provider } = memoryProvider<typeof recipes>([]);

		await resourceOperations(recipes, provider).exportList(context, {
			search: 'curry',
			sort: { field: 'name', order: 'desc' },
			filters: [{ field: 'vegan', operator: 'eq', value: true }]
		});

		expect(listed).toEqual([
			{
				search: 'curry',
				sort: { field: 'name', order: 'desc' },
				filters: [{ field: 'vegan', operator: 'eq', value: true }],
				page: 1,
				perPage: MAX_PER_PAGE
			}
		]);
	});
});

const items = defineResource({
	name: 'items',
	label: 'Items',
	schema: z.object({ id: z.number() })
});

/** Items 1 to `count`. */
const itemRows = (count: number) =>
	Array.from({ length: count }, (_, index) => ({ id: index + 1 }));

/** The ids an export of items holds, in order. */
const exportedIds = (csv: string) =>
	lines(csv)
		.slice(1)
		.map((line) => Number(line.slice(1, -1)));

/** Export every item, recording the page and the page size of each page asked for. */
async function exportItems(
	rows: readonly Row[],
	options: Parameters<typeof memoryProvider>[1] & { maxExportRows?: number } = {}
) {
	const { maxExportRows, ...providerOptions } = options;
	const { listed, provider } = memoryProvider<typeof items>(rows, providerOptions);
	const outcome = await resourceOperations(items, provider, { maxExportRows }).exportList(
		context,
		{}
	);
	if (!outcome.ok) throw new Error(`The export failed: ${outcome.failure.message}`);
	const { csv, ...summary } = outcome.value;
	return {
		ids: exportedIds(csv),
		summary,
		asked: listed.map(({ page, perPage }) => [page, perPage])
	};
}

describe('the pages an export reads', () => {
	it.each(['total', 'hasNextPage'] as const)(
		'reads page after page of MAX_PER_PAGE until the last one, answered with %s',
		async (answer) => {
			const { ids, summary, asked } = await exportItems(itemRows(230), { answer });

			expect(ids).toEqual(itemRows(230).map((row) => row.id));
			expect(summary.capped).toBe(false);
			expect(asked).toEqual([
				[1, MAX_PER_PAGE],
				[2, MAX_PER_PAGE],
				[3, MAX_PER_PAGE]
			]);
		}
	);

	it('gives the total when the Provider counts, and none when it can’t', async () => {
		expect((await exportItems(itemRows(5))).summary).toEqual({ rows: 5, capped: false, total: 5 });
		expect((await exportItems(itemRows(5), { answer: 'hasNextPage' })).summary).toEqual({
			rows: 5,
			capped: false
		});
	});

	it('stops when the total is reached, without asking for an empty page', async () => {
		const { ids, asked } = await exportItems(itemRows(200));

		expect(ids).toHaveLength(200);
		expect(asked).toEqual([
			[1, MAX_PER_PAGE],
			[2, MAX_PER_PAGE]
		]);
	});

	it('stops at a page that comes back short, whatever the Provider says', async () => {
		const { ids, asked } = await exportItems([], {
			answer: ({ page }) => ({
				data: page === 1 ? itemRows(MAX_PER_PAGE) : itemRows(3),
				hasNextPage: true
			})
		});

		expect(ids).toHaveLength(MAX_PER_PAGE + 3);
		expect(asked.map(([page]) => page)).toEqual([1, 2]);
	});

	it('stops at an empty page', async () => {
		const { ids, summary } = await exportItems([], {
			answer: () => ({ data: [], hasNextPage: true })
		});

		expect(ids).toEqual([]);
		expect(summary).toEqual({ rows: 0, capped: false });
	});

	it('stops at the cap, keeping the first records, and says there were more', async () => {
		const { ids, summary, asked } = await exportItems(itemRows(230), { maxExportRows: 150 });

		expect(ids).toEqual(itemRows(150).map((row) => row.id));
		expect(summary).toEqual({ rows: 150, capped: true, total: 230 });
		expect(asked).toEqual([
			[1, MAX_PER_PAGE],
			[2, MAX_PER_PAGE]
		]);
	});

	it('asks for pages no larger than a cap below MAX_PER_PAGE', async () => {
		const { ids, summary, asked } = await exportItems(itemRows(60), {
			answer: 'hasNextPage',
			maxExportRows: 50
		});

		expect(ids).toEqual(itemRows(50).map((row) => row.id));
		expect(summary).toEqual({ rows: 50, capped: true });
		expect(asked).toEqual([[1, 50]]);
	});

	it('isn’t capped when the records end exactly at the cap', async () => {
		expect(
			(await exportItems(itemRows(50), { answer: 'hasNextPage', maxExportRows: 50 })).summary
		).toEqual({ rows: 50, capped: false });
		expect((await exportItems(itemRows(200), { maxExportRows: 200 })).summary).toEqual({
			rows: 200,
			capped: false,
			total: 200
		});
	});

	it('caps at 10,000 records by default', async () => {
		const { summary, asked } = await exportItems(itemRows(10_050));

		expect(summary).toEqual({ rows: 10_000, capped: true, total: 10_050 });
		expect(asked).toHaveLength(10_000 / MAX_PER_PAGE);
	});

	it('fails as a whole when any page gets a Provider error: there is no partial file', async () => {
		const { provider } = memoryProvider<typeof items>([], {
			answer: ({ page }) => {
				if (page === 2) throw new InvalidInputError('Bad filter');
				return { data: itemRows(MAX_PER_PAGE), hasNextPage: true };
			}
		});

		expect(await resourceOperations(items, provider).exportList(context, {})).toEqual({
			ok: false,
			failure: { reason: 'provider-error', status: 400, message: 'Bad filter' }
		});
	});

	it('rejects when any page throws anything else, or holds a record that doesn’t match the schema', async () => {
		const { provider: down } = memoryProvider<typeof items>([], {
			answer: () => {
				throw new Error('Backend down');
			}
		});
		const { provider: broken } = memoryProvider<typeof items>([{ id: 'one' }]);

		await expect(resourceOperations(items, down).exportList(context, {})).rejects.toThrow(
			'Backend down'
		);
		await expect(resourceOperations(items, broken).exportList(context, {})).rejects.toThrow();
	});

	it.each([0, -1, 1.5, Number.NaN])('refuses a cap of %s', (maxExportRows) => {
		const { provider } = memoryProvider<typeof items>([]);

		expect(() => resourceOperations(items, provider, { maxExportRows })).toThrow(
			`\`maxExportRows\` must be a whole number from 1, not ${maxExportRows}`
		);
	});
});

/** The CSV an export of `rows` writes, through an in-memory Provider. */
async function csvOf(resource: Resource, rows: readonly Row[]): Promise<string> {
	const outcome = await resourceOperations(resource, memoryProvider(rows).provider).exportList(
		context,
		{}
	);
	if (!outcome.ok) throw new Error(`The export failed: ${outcome.failure.message}`);
	return outcome.value.csv;
}

describe('the CSV an export writes', () => {
	it('starts with a UTF-8 byte order mark and ends every row with CRLF', async () => {
		const csv = await csvOf(notes, [
			{ id: 1, text: 'Crème brûlée' },
			{ id: 2, text: 'Ramen' }
		]);

		expect(csv.startsWith(BOM)).toBe(true);
		expect(csv.slice(BOM.length)).toBe('"ID","Text"\r\n"1","Crème brûlée"\r\n"2","Ramen"\r\n');
	});

	it('writes only the header row for no records', async () => {
		expect(await csvOf(notes, [])).toBe(`${BOM}"ID","Text"\r\n`);
	});

	it('quotes every cell and doubles the quotes inside one, keeping commas and line breaks', async () => {
		const csv = await csvOf(notes, [{ id: 1, text: 'Say "cheese",\nthen smile' }]);

		expect(csv).toBe(`${BOM}"ID","Text"\r\n"1","Say ""cheese"",\nthen smile"\r\n`);
	});

	it('has one column per Field that isn’t hidden, in schema order, headed by its label', async () => {
		const recipes = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				name: z.string(),
				internalNotes: field(z.string(), { hidden: true }),
				prepTimeMinutes: field(z.number(), { label: 'Prep time (min)' }),
				// Not in the list View, but on the detail View, so in the export.
				instructions: field(z.string(), { list: false })
			})
		});

		const csv = await csvOf(recipes, [
			{ id: 1, name: 'Pizza', internalNotes: 'secret', prepTimeMinutes: 20, instructions: 'Bake' }
		]);

		expect(lines(csv)).toEqual([
			'"ID","Name","Prep time (min)","Instructions"',
			'"1","Pizza","20","Bake"'
		]);
	});

	it('writes each kind of value', async () => {
		const everything = defineResource({
			name: 'everything',
			label: 'Everything',
			schema: z.object({
				id: z.number(),
				text: z.string(),
				number: z.number(),
				decimal: z.number(),
				yes: z.boolean(),
				no: z.boolean(),
				isoDate: z.iso.date(),
				isoDatetime: z.iso.datetime(),
				date: z.date(),
				tags: z.array(z.string()),
				scores: z.array(z.number()),
				nutrition: z.object({ proteinGrams: z.number() }),
				ingredients: z.array(z.object({ name: z.string(), quantity: z.string().optional() })),
				level: z.enum(['Easy', 'Hard']),
				missing: z.string().optional(),
				nothing: z.string().nullable()
			})
		});

		const csv = await csvOf(everything, [
			{
				id: 7,
				text: 'Pad Thai',
				number: 1250,
				decimal: 45.5,
				yes: true,
				no: false,
				isoDate: '2024-03-01',
				isoDatetime: '2024-03-01T23:30:00.000Z',
				date: new Date(Date.UTC(2024, 2, 1, 12)),
				tags: ['Thai', 'Noodles'],
				scores: [3, 4.5],
				nutrition: { proteinGrams: 12 },
				ingredients: [{ name: 'Rice noodles', quantity: '200 g' }, { name: 'Lime' }],
				level: 'Easy',
				nothing: null
			}
		]);

		expect(lines(csv)[1]).toBe(
			[
				'"7"',
				'"Pad Thai"',
				'"1250"',
				'"45.5"',
				'"true"',
				'"false"',
				'"2024-03-01"',
				'"2024-03-01T23:30:00.000Z"',
				'"2024-03-01T12:00:00.000Z"',
				'"Thai, Noodles"',
				'"3, 4.5"',
				'"{""proteinGrams"":12}"',
				'"[{""name"":""Rice noodles"",""quantity"":""200 g""},{""name"":""Lime""}]"',
				'"Easy"',
				'""',
				'""'
			].join(',')
		);
	});

	it('writes very large and very small numbers as plain decimals, never with an exponent', async () => {
		const ledger = defineResource({
			name: 'ledger',
			label: 'Ledger',
			schema: z.object({ id: z.number(), amount: z.number() })
		});

		const csv = await csvOf(ledger, [
			{ id: 1, amount: 1e21 },
			{ id: 2, amount: -1.5e22 },
			{ id: 3, amount: 1e-7 },
			{ id: 4, amount: -2.5e-8 }
		]);

		expect(lines(csv).slice(1)).toEqual([
			'"1","1000000000000000000000"',
			'"2","-15000000000000000000000"',
			'"3","0.0000001"',
			'"4","-0.000000025"'
		]);
	});

	describe('the formula guard', () => {
		it.each(['=SUM(A1:A2)', '+1', '-1+2', '@cmd', '\tTabbed', '\rReturned'])(
			'prefixes a text cell starting %j with an apostrophe',
			async (text) => {
				const csv = await csvOf(notes, [{ id: 1, text }]);

				expect(lines(csv)[1]).toBe(`"1","'${text}"`);
			}
		);

		it('leaves other text alone, including those characters further in', async () => {
			const csv = await csvOf(notes, [{ id: 1, text: 'a=b, c+d, e-f, me@example.com' }]);

			expect(lines(csv)[1]).toBe('"1","a=b, c+d, e-f, me@example.com"');
		});

		it('never prefixes a number, so a negative one stays a number', async () => {
			const ledger = defineResource({
				name: 'ledger',
				label: 'Ledger',
				schema: z.object({ id: z.number(), amount: z.number() })
			});

			const csv = await csvOf(ledger, [{ id: -1, amount: -5 }]);

			expect(lines(csv)[1]).toBe('"-1","-5"');
		});

		it('guards a list of values joined as text', async () => {
			const tagged = defineResource({
				name: 'tagged',
				label: 'Tagged',
				schema: z.object({ id: z.number(), tags: z.array(z.string()) })
			});

			const csv = await csvOf(tagged, [{ id: 1, tags: ['=HYPERLINK("x")', 'safe'] }]);

			expect(lines(csv)[1]).toBe('"1","\'=HYPERLINK(""x""), safe"');
		});

		it('guards the headers too', async () => {
			const sheet = defineResource({
				name: 'sheet',
				label: 'Sheet',
				schema: z.object({ id: z.number(), total: field(z.number(), { label: '=1+1' }) })
			});

			expect(lines(await csvOf(sheet, []))[0]).toBe('"ID","\'=1+1"');
		});
	});
});
