import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	activeFilters,
	defineAdmin,
	defineResource,
	field,
	formSchema,
	listParamsSchema,
	readListParams,
	resolveReference,
	toFormSpec,
	type FieldMeta,
	type Resource,
	type ResourceRemote
} from '@svelte-admin/core';

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

const tags = defineResource({
	name: 'tags',
	label: 'Tags',
	schema: z.object({ id: z.string(), name: z.string() })
});

const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({
		id: z.number(),
		title: z.string(),
		userId: field(z.number(), { label: 'Author', ref: () => users, filterable: true }),
		tagId: field(z.string(), { ref: () => tags, filterable: ['eq'] }).optional()
	})
});

// The remote functions only run inside a SvelteKit app; these tests never call them.
const remote = async () => ({}) as unknown as ResourceRemote;

/** A Resource with one more Field beside its id, built loosely so the runtime checks are reached. */
function withField(name: string, schema: Record<string, z.ZodType>, extra: object = {}): Resource {
	return defineResource({
		name,
		label: name,
		schema: z.object({ id: z.number(), ...schema }),
		...extra
	} as unknown as Parameters<typeof defineResource>[0]);
}

describe('a Reference', () => {
	it('is a Field of the built-in Kind `reference`, keeping its target', () => {
		const author = posts.fields.find((candidate) => candidate.key === 'userId');
		expect(author).toMatchObject({ kind: 'reference', label: 'Author', id: 'number' });
		expect(author?.kind === 'reference' && author.ref()).toBe(users);
	});

	it('keeps its target inside or outside a wrapper, and knows a string id', () => {
		const tag = posts.fields.find((candidate) => candidate.key === 'tagId');
		expect(tag).toMatchObject({ kind: 'reference', id: 'string', required: false });
		const wrapped = withField('notes', {
			userId: field(z.number().nullable(), { ref: () => users })
		}).fields.find((candidate) => candidate.key === 'userId');
		expect(wrapped).toMatchObject({ kind: 'reference', id: 'number', required: false });
	});

	it('is filtered by equality only', () => {
		const author = posts.fields.find((candidate) => candidate.key === 'userId');
		expect(author?.filterOperators).toEqual(['eq']);
	});

	it('never calls its target while the Resource is defined, so a Resource may reference itself', () => {
		const comments: Resource = defineResource({
			name: 'comments',
			label: 'Comments',
			schema: z.object({
				id: z.number(),
				replyToId: field(z.number(), { ref: (): Resource => comments }).optional()
			})
		});
		const reply = comments.fields.find((candidate) => candidate.key === 'replyToId');
		expect(reply?.kind === 'reference' && reply.ref()).toBe(comments);
	});
});

describe("a Reference's startup checks in defineResource", () => {
	it('throws for a sortable Reference, naming the Resource and the Field', () => {
		expect(() =>
			// Typed loosely: TypeScript rejects a sortable Reference already.
			withField('notes', {
				userId: field(z.number(), { ref: () => users, sortable: true } as FieldMeta)
			})
		).toThrow(/Resource "notes".*"userId".*sortable.*Reference/);
	});

	it('throws for an operator other than `eq`', () => {
		expect(() =>
			withField('notes', {
				userId: field(z.number(), { ref: () => users, filterable: ['eq', 'gte'] as never })
			})
		).toThrow(/Resource "notes".*"userId".*"gte"/);
	});

	it.each([
		['a nested object', { meta: z.object({ userId: field(z.number(), { ref: () => users }) }) }],
		[
			'an optional nested object',
			{ meta: z.object({ userId: field(z.number(), { ref: () => users }) }).optional() }
		],
		['an array element', { userIds: z.array(field(z.number(), { ref: () => users })) }],
		[
			'an object in an array',
			{ authors: z.array(z.object({ userId: field(z.number(), { ref: () => users }) })) }
		]
	])('throws for a `ref` inside %s, naming the Resource and the Field', (_, schema) => {
		const [key] = Object.keys(schema);
		expect(() => withField('notes', schema)).toThrow(
			new RegExp(`Resource "notes".*"${key}".*Reference.*top-level`)
		);
	});

	it('throws for a `recordTitle` that names a Reference', () => {
		expect(() =>
			withField(
				'notes',
				{ userId: field(z.number(), { ref: () => users }) },
				{ recordTitle: 'userId' }
			)
		).toThrow(/Resource "notes".*recordTitle.*"userId".*Reference/);
	});

	it('throws for a Reference whose type is not a string or a number', () => {
		expect(() =>
			withField('notes', { userId: field(z.boolean(), { ref: () => users } as never) })
		).toThrow(/Resource "notes".*"userId".*Reference.*string or a number/);
	});
});

describe("a Reference's startup checks in defineAdmin", () => {
	it('passes when every target is mounted', () => {
		expect(() =>
			defineAdmin({
				basePath: '/admin',
				resources: {
					posts: { resource: posts, remote },
					users: { resource: users, remote },
					tags: { resource: tags, remote }
				}
			})
		).not.toThrow();
	});

	it('throws when a target is not mounted, naming the Resource, the Field and the target', () => {
		expect(() =>
			defineAdmin({
				basePath: '/admin',
				resources: { posts: { resource: posts, remote }, tags: { resource: tags, remote } }
			})
		).toThrow(/Resource "posts".*"userId".*"users".*not.*admin\.ts/);
	});

	it('throws when the entry under the target’s name holds another Resource object', () => {
		const otherUsers = defineResource({
			name: 'users',
			label: 'Other users',
			schema: z.object({ id: z.number(), name: z.string() })
		});
		expect(() =>
			defineAdmin({
				basePath: '/admin',
				resources: {
					posts: { resource: posts, remote },
					users: { resource: otherUsers, remote },
					tags: { resource: tags, remote }
				}
			})
		).toThrow(/Resource "posts".*"userId".*"users".*another Resource/);
	});
});

describe('a Reference filter in the list URL', () => {
	const read = (query: string) =>
		readListParams(new URL(`http://admin.test/posts?${query}`), posts);

	it('reads a number id from a bare param', () => {
		expect(read('userId=3').filters).toEqual([{ field: 'userId', operator: 'eq', value: 3 }]);
	});

	it('reads a string id as written', () => {
		expect(read('tagId=bread').filters).toEqual([
			{ field: 'tagId', operator: 'eq', value: 'bread' }
		]);
	});

	it.each(['3a', '03', '3.0', '1e1', ' 3', ''])(
		'drops %j, which names no number id by the route param rule',
		(value) => {
			expect(read(`userId=${encodeURIComponent(value)}`).filters).toBeUndefined();
		}
	);

	it('keeps one value of a repeated param, since a Reference has no `in`', () => {
		expect(read('userId=3&userId=4').filters).toEqual([
			{ field: 'userId', operator: 'eq', value: 3 }
		]);
	});

	it('ignores operators other than `eq`', () => {
		expect(read('userId.gte=3').filters).toBeUndefined();
	});
});

describe('a Reference filter in getList', () => {
	const schema = listParamsSchema(posts);
	const parse = (filters: unknown) => schema.safeParse({ page: 1, perPage: 25, filters });

	it('takes `eq` with an id of the target’s type, number or string', () => {
		expect(parse([{ field: 'userId', operator: 'eq', value: 3 }]).success).toBe(true);
		expect(parse([{ field: 'tagId', operator: 'eq', value: 'bread' }]).success).toBe(true);
	});

	it.each([
		['another operator', { field: 'userId', operator: 'gte', value: 3 }],
		['`in`', { field: 'userId', operator: 'in', value: [3, 4] }],
		['a string for a number id', { field: 'userId', operator: 'eq', value: '3' }],
		['a number for a string id', { field: 'tagId', operator: 'eq', value: 3 }]
	])('rejects %s', (_, filter) => {
		expect(parse([filter]).success).toBe(false);
	});
});

describe('a Reference on the create and edit forms, until the Reference picker', () => {
	it('is an input for the id itself: a number input for a number id, a text input for a string', () => {
		const specs = toFormSpec(posts, 'create');
		expect(specs.find((spec) => spec.key === 'userId')).toMatchObject({
			kind: 'number',
			label: 'Author',
			required: true
		});
		expect(specs.find((spec) => spec.key === 'tagId')).toMatchObject({
			kind: 'text',
			required: false
		});
	});

	it('saves the id with its type, and reports an empty required Reference as Required', () => {
		const schema = formSchema(posts, 'create');
		expect(schema['~standard'].validate({ title: 'Hi', userId: 3, tagId: 'bread' })).toEqual({
			value: { title: 'Hi', userId: 3, tagId: 'bread' }
		});
		expect(schema['~standard'].validate({ title: 'Hi' })).toEqual({
			issues: [{ message: 'Required', path: ['userId'] }]
		});
	});
});

describe("a Reference's link, for the list and detail Views", () => {
	const ada = { id: 3, name: 'Ada Lovelace' };
	const bread = { id: 'bread/rye', name: 'Bread' };

	/** An admin whose `lookup`s answer from `records`, recording each id they are asked for. */
	function adminWith(lookup: (id: string | number) => Promise<unknown>) {
		const asked: (string | number)[] = [];
		const targetRemote = async () =>
			({
				lookup: (id: string | number) => {
					asked.push(id);
					return lookup(id);
				}
			}) as unknown as ResourceRemote;
		const admin = defineAdmin({
			basePath: '/admin',
			resources: {
				posts: { resource: posts, remote },
				users: { resource: users, remote: targetRemote },
				tags: { resource: tags, remote: targetRemote }
			}
		});
		return { admin, asked };
	}

	const known = async (id: string | number) =>
		[ada, bread].find((record) => record.id === id) ?? null;
	const author = posts.fields.find((candidate) => candidate.key === 'userId')!;
	const tag = posts.fields.find((candidate) => candidate.key === 'tagId')!;

	it("is the target record's Record title, linked to its detail View under the base path", async () => {
		const { admin, asked } = adminWith(known);

		expect(await resolveReference(admin, author, 3)).toEqual({
			title: 'Ada Lovelace',
			href: '/admin/users/3'
		});
		expect(asked).toEqual([3]);
	});

	it('escapes the id in the href, so it stays one path segment', async () => {
		const { admin } = adminWith(known);

		expect(await resolveReference(admin, tag, 'bread/rye')).toEqual({
			title: 'Bread',
			href: '/admin/tags/bread%2Frye'
		});
	});

	it('is undefined for a record that does not exist', async () => {
		const { admin } = adminWith(known);

		expect(await resolveReference(admin, author, 9)).toBeUndefined();
	});

	it('is undefined when the lookup fails, so a View never fails for it', async () => {
		const { admin } = adminWith(async () => {
			throw { status: 500, body: { message: 'Internal Error' } };
		});

		expect(await resolveReference(admin, author, 3)).toBeUndefined();
	});

	it('asks nothing for an empty value or a Field that is not a Reference', async () => {
		const { admin, asked } = adminWith(known);
		const title = posts.fields.find((candidate) => candidate.key === 'title')!;

		expect(await resolveReference(admin, author, undefined)).toBeUndefined();
		expect(await resolveReference(admin, author, null)).toBeUndefined();
		expect(await resolveReference(admin, title, 3)).toBeUndefined();
		expect(asked).toEqual([]);
	});
});

describe('a Reference filter chip', () => {
	it('names the id as the URL writes it', () => {
		const url = new URL('http://admin.test/admin/posts?userId=1234');
		const [chip] = activeFilters(url, posts);
		expect(chip?.label).toBe('Author: 1234');
	});
});
