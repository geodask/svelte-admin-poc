import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	createReferencePicker,
	defineAdmin,
	defineResource,
	field,
	toFormSpec,
	type FormInputSpec,
	type ListParams,
	type ResourceRemote
} from '@svelte-admin/core';

// Users can be searched; tags can't, so their picker filters a page of them by title.
const users = defineResource({
	name: 'users',
	label: 'Users',
	searchable: true,
	schema: z.object({ id: z.number(), name: z.string() })
});

const tags = defineResource({
	name: 'tags',
	label: 'Tags',
	schema: z.object({ id: z.string(), label: z.string() }),
	recordTitle: 'label'
});

const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({
		id: z.number(),
		userId: field(z.number(), { label: 'Author', ref: () => users }),
		tagId: field(z.string(), { ref: () => tags }).optional()
	})
});

const people = [
	{ id: 1, name: 'Ada Lovelace' },
	{ id: 2, name: 'Grace Hopper' },
	{ id: 3, name: 'Alan Turing' }
];
const labels = [
	{ id: 'bread', label: 'Bread' },
	{ id: 'rye', label: 'Rye bread' },
	{ id: 'cake', label: 'Cake' }
];

/**
 * An admin whose targets answer from `records`: `getList` with its first page (and, for a search,
 * the records whose title holds it), and `lookup` with the record or `null`. It records each call.
 * `firstPage` caps the first page below the size asked for.
 */
function adminWith(options: { failList?: boolean; failLookup?: boolean; firstPage?: number } = {}) {
	const calls: { resource: string; method: 'getList' | 'lookup'; arg: unknown }[] = [];
	const remoteOf =
		(resource: string, records: Record<string, unknown>[], title: string) => async () =>
			({
				getList: async (params: ListParams) => {
					calls.push({ resource, method: 'getList', arg: params });
					if (options.failList) throw { status: 500, body: { message: 'Internal Error' } };
					const search = params.search?.toLowerCase();
					const data = records.filter(
						(record) => search === undefined || String(record[title]).toLowerCase().includes(search)
					);
					return { data: data.slice(0, options.firstPage ?? params.perPage), total: data.length };
				},
				lookup: async (id: string | number) => {
					calls.push({ resource, method: 'lookup', arg: id });
					if (options.failLookup) throw { status: 500, body: { message: 'Internal Error' } };
					return records.find((record) => record.id === id) ?? null;
				}
			}) as unknown as ResourceRemote;
	const admin = defineAdmin({
		basePath: '/admin',
		resources: {
			posts: { resource: posts, remote: async () => ({}) as unknown as ResourceRemote },
			users: { resource: users, remote: remoteOf('users', people, 'name') },
			tags: { resource: tags, remote: remoteOf('tags', labels, 'label') }
		}
	});
	return { admin, calls };
}

const author = posts.fields.find((candidate) => candidate.key === 'userId')!;
const tag = posts.fields.find((candidate) => candidate.key === 'tagId')!;
const specOf = (key: string) =>
	toFormSpec(posts, 'edit').find((spec) => spec.key === key) as FormInputSpec;

describe('createReferencePicker', () => {
	it('gives the target Resource, from a Reference Field or its form spec', () => {
		const { admin } = adminWith();

		expect(createReferencePicker(admin, author, undefined).target).toBe(users);
		expect(createReferencePicker(admin, specOf('userId'), undefined).target).toBe(users);
		expect(createReferencePicker(admin, specOf('tagId'), undefined).target).toBe(tags);
	});

	it('throws for a Field that is not a Reference', () => {
		const { admin } = adminWith();
		const id = posts.fields.find((candidate) => candidate.key === 'id')!;

		expect(() => createReferencePicker(admin, id, undefined)).toThrow(/"id".*not a Reference/);
	});

	it('asks for nothing until it is read', () => {
		const { admin, calls } = adminWith();

		createReferencePicker(admin, author, 3);

		expect(calls).toEqual([]);
	});

	describe('the current choice’s title', () => {
		it('is the Record title of the record, through lookup', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, author, 3).title).toBe('Alan Turing');
			expect(calls).toEqual([{ resource: 'users', method: 'lookup', arg: 3 }]);
		});

		it('reads the id a form holds as text in the target’s id type', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, specOf('userId'), '3').title).toBe('Alan Turing');
			expect(calls).toEqual([{ resource: 'users', method: 'lookup', arg: 3 }]);
		});

		it('uses the target’s own Record title setting', async () => {
			const { admin } = adminWith();

			expect(await createReferencePicker(admin, tag, 'rye').title).toBe('Rye bread');
		});

		it('is undefined for no choice, an id that names no record, and a failed lookup', async () => {
			const { admin, calls } = adminWith();
			expect(await createReferencePicker(admin, author, undefined).title).toBeUndefined();
			expect(await createReferencePicker(admin, author, '').title).toBeUndefined();
			expect(await createReferencePicker(admin, author, null).title).toBeUndefined();
			// Not a user id at all, so nothing is asked.
			expect(await createReferencePicker(admin, author, '3a').title).toBeUndefined();
			expect(calls).toEqual([]);

			expect(await createReferencePicker(admin, author, 9).title).toBeUndefined();
			const failing = adminWith({ failLookup: true }).admin;
			expect(await createReferencePicker(failing, author, 3).title).toBeUndefined();
		});
	});

	describe('the options without JavaScript', () => {
		it('are the first 50 records in the target’s default order, by their Record title', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, author, undefined).options).toEqual([
				{ id: 1, title: 'Ada Lovelace' },
				{ id: 2, title: 'Grace Hopper' },
				{ id: 3, title: 'Alan Turing' }
			]);
			// No sort: `getList` gives the Provider the target's default sort.
			expect(calls).toEqual([
				{ resource: 'users', method: 'getList', arg: { page: 1, perPage: 50 } }
			]);
		});

		it('look up nothing when the current record is among them', async () => {
			const { admin, calls } = adminWith();

			await createReferencePicker(admin, author, '2').options;

			expect(calls.map((call) => call.method)).toEqual(['getList']);
		});

		it('add the current record when it is not among them', async () => {
			// Only one record is on the first page here.
			const { admin } = adminWith({ firstPage: 1 });

			expect(await createReferencePicker(admin, author, '3').options).toEqual([
				{ id: 1, title: 'Ada Lovelace' },
				{ id: 3, title: 'Alan Turing' }
			]);
		});

		it('add a current id that names no record as itself, marked missing', async () => {
			const { admin } = adminWith();

			expect(await createReferencePicker(admin, author, 99).options).toEqual([
				{ id: 1, title: 'Ada Lovelace' },
				{ id: 2, title: 'Grace Hopper' },
				{ id: 3, title: 'Alan Turing' },
				{ id: 99, title: '99', missing: true }
			]);
		});

		it('fail when the first page fails', async () => {
			const { admin } = adminWith({ failList: true });

			await expect(createReferencePicker(admin, author, undefined).options).rejects.toMatchObject({
				status: 500
			});
		});
	});

	describe('search', () => {
		it('asks a searchable target for the first 50 records that match, trimmed', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, author, undefined).search('  tur ')).toEqual([
				{ id: 3, title: 'Alan Turing' }
			]);
			expect(calls).toEqual([
				{ resource: 'users', method: 'getList', arg: { page: 1, perPage: 50, search: 'tur' } }
			]);
		});

		it('asks for the first 50 records with no search for blank text', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, author, undefined).search('  ')).toHaveLength(3);
			expect(calls).toEqual([
				{ resource: 'users', method: 'getList', arg: { page: 1, perPage: 50 } }
			]);
		});

		it('filters the first 50 records of a target that is not searchable by title, ignoring case', async () => {
			const { admin, calls } = adminWith();

			expect(await createReferencePicker(admin, tag, undefined).search('BREAD')).toEqual([
				{ id: 'bread', title: 'Bread' },
				{ id: 'rye', title: 'Rye bread' }
			]);
			expect(calls).toEqual([
				{ resource: 'tags', method: 'getList', arg: { page: 1, perPage: 50 } }
			]);
		});
	});
});
