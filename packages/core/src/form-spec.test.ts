import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	field,
	formSchema,
	toFormSpec,
	toFormValues,
	type Resource
} from '@svelte-admin/core';

/** A Resource with one Field, `value`, of the given type. */
const withField = (schema: z.ZodType) =>
	defineResource({
		name: 'things',
		label: 'Things',
		schema: z.object({ id: z.number(), value: schema })
	});

/** The create form spec of a Resource's single Field, `value`. */
const specOf = (schema: z.ZodType) => toFormSpec(withField(schema), 'create')[0];

describe('toFormSpec', () => {
	describe('maps each scalar Zod type to an input', () => {
		it.each([
			['a string', z.string(), { kind: 'text', format: 'text' }],
			['an email', z.email(), { kind: 'text', format: 'email' }],
			['a string with an email check', z.string().email(), { kind: 'text', format: 'email' }],
			['a url', z.url(), { kind: 'text', format: 'url' }],
			['a number', z.number(), { kind: 'number', integer: false }],
			['an int', z.int(), { kind: 'number', integer: true }],
			['a number with an int check', z.number().int(), { kind: 'number', integer: true }],
			['a boolean', z.boolean(), { kind: 'checkbox' }],
			['an enum', z.enum(['Easy', 'Hard']), { kind: 'select', options: ['Easy', 'Hard'] }],
			['an ISO date', z.iso.date(), { kind: 'date' }],
			['a Date', z.date(), { kind: 'date' }],
			['an ISO datetime', z.iso.datetime(), { kind: 'datetime' }]
		])('%s', (_, schema, input) => {
			expect(specOf(schema)).toMatchObject(input);
		});
	});

	it.each([
		['optional', (schema: z.ZodType) => schema.optional()],
		['nullable', (schema: z.ZodType) => schema.nullable()],
		['default', (schema: z.ZodString) => schema.default('x')]
	])('sees the input through %s, which makes the Field not required', (_, wrap) => {
		expect(specOf(z.string())).toMatchObject({ kind: 'text', required: true });
		expect(specOf(wrap(z.string()))).toMatchObject({
			kind: 'text',
			format: 'text',
			required: false
		});
	});

	it.each([
		['optional', (schema: z.ZodType) => schema.optional()],
		['nullable', (schema: z.ZodType) => schema.nullable()]
	])('maps every scalar type the same when it is %s, and not required', (_, wrap) => {
		const scalars: [z.ZodType, object][] = [
			[z.email(), { kind: 'text', format: 'email' }],
			[z.url(), { kind: 'text', format: 'url' }],
			[z.number(), { kind: 'number', integer: false }],
			[z.boolean(), { kind: 'checkbox' }],
			[z.iso.date(), { kind: 'date' }],
			[z.date(), { kind: 'date' }],
			[z.iso.datetime(), { kind: 'datetime' }]
		];
		for (const [schema, input] of scalars) {
			expect(specOf(wrap(schema))).toMatchObject({ ...input, required: false });
		}
	});

	it('sees through a wrapper on an int, an enum and a datetime too', () => {
		expect(specOf(z.int().optional())).toMatchObject({ kind: 'number', integer: true });
		expect(specOf(z.enum(['a', 'b']).nullable())).toMatchObject({
			kind: 'select',
			options: ['a', 'b']
		});
		expect(specOf(z.iso.datetime().default('2024-01-01T00:00:00Z'))).toMatchObject({
			kind: 'datetime'
		});
	});

	it('gives every Field its label and description, in schema order, and leaves out the id', () => {
		const users = defineResource({
			name: 'users',
			label: 'Users',
			schema: z.object({
				id: z.number(),
				name: z.string(),
				email: field(z.email(), { label: 'Email address', description: 'Where we write' }),
				joinedAt: z.iso.datetime()
			})
		});

		expect(toFormSpec(users, 'create')).toEqual([
			{ key: 'name', label: 'Name', required: true, kind: 'text', format: 'text' },
			{
				key: 'email',
				label: 'Email address',
				description: 'Where we write',
				required: true,
				kind: 'text',
				format: 'email'
			},
			{ key: 'joinedAt', label: 'Joined at', required: true, kind: 'datetime' }
		]);
	});

	it('leaves out the Kinds it has no input for yet: lists, objects and unknown', () => {
		const recipes = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				name: z.string(),
				tags: z.array(z.string()),
				nutrition: z.object({ calories: z.number() }),
				sourceId: z.union([z.string(), z.number()]),
				servings: z.number()
			})
		});

		expect(toFormSpec(recipes, 'create').map((input) => input.key)).toEqual(['name', 'servings']);
	});
});

/** Run a form schema on raw input, as Kit does with what the browser sent. */
async function validate(schema: ReturnType<typeof formSchema>, input: Record<string, unknown>) {
	return schema['~standard'].validate(input);
}

/** The issues of a failed validation as `path: message`, or the value when it passed. */
async function outcome(schema: ReturnType<typeof formSchema>, input: Record<string, unknown>) {
	const result = await validate(schema, input);
	if (result.issues === undefined) return { value: result.value };
	return {
		issues: result.issues.map(
			(issue) => `${(issue.path ?? []).map(String).join('.')}: ${issue.message}`
		)
	};
}

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({
		id: z.number(),
		name: z.string(),
		email: z.email({ error: 'Enter a valid email address' }),
		role: z.enum(['admin', 'editor', 'viewer']),
		active: z.boolean(),
		joinedAt: z.iso.datetime(),
		age: z.int().optional()
	})
});

const filledUser = {
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	role: 'admin',
	active: true,
	joinedAt: '2024-03-01T09:30'
};

describe('formSchema', () => {
	it('gives the validated record without its id', async () => {
		expect(await outcome(formSchema(users, 'create'), { ...filledUser, id: 7 })).toEqual({
			value: {
				name: 'Ada Lovelace',
				email: 'ada@example.com',
				role: 'admin',
				active: true,
				joinedAt: '2024-03-01T09:30:00.000Z'
			}
		});
	});

	it('treats an empty input as no value, so a required Field reports "Required"', async () => {
		expect(
			await outcome(formSchema(users, 'create'), { ...filledUser, name: '', role: '' })
		).toEqual({ issues: ['name: Required', 'role: Required'] });
	});

	it('reports "Required" for a Field missing from the input', async () => {
		const withoutName: Record<string, unknown> = { ...filledUser };
		delete withoutName.name;
		expect(await outcome(formSchema(users, 'create'), withoutName)).toEqual({
			issues: ['name: Required']
		});
	});

	it('leaves an empty optional Field out of the record', async () => {
		const result = await outcome(formSchema(users, 'create'), { ...filledUser, age: undefined });
		expect(result).toEqual({ value: expect.not.objectContaining({ age: expect.anything() }) });
	});

	it('gives null for an empty nullable Field, and the default for an empty Field with one', async () => {
		const notes = withField(z.string().nullable());
		const counted = withField(z.number().default(0));

		expect(await outcome(formSchema(notes, 'create'), { value: '' })).toEqual({
			value: { value: null }
		});
		expect(await outcome(formSchema(counted, 'create'), {})).toEqual({ value: { value: 0 } });
	});

	it('reads an unchecked checkbox as false', async () => {
		const unchecked: Record<string, unknown> = { ...filledUser };
		delete unchecked.active;
		expect(await outcome(formSchema(users, 'create'), unchecked)).toEqual({
			value: expect.objectContaining({ active: false })
		});
	});

	it('turns a date string into the type the schema wants', async () => {
		expect(
			await outcome(formSchema(withField(z.iso.date()), 'create'), { value: '2024-01-08' })
		).toEqual({ value: { value: '2024-01-08' } });
		expect(
			await outcome(formSchema(withField(z.date()), 'create'), { value: '2024-01-08' })
		).toEqual({ value: { value: new Date(Date.UTC(2024, 0, 8)) } });
	});

	it('reads a datetime input in UTC and gives an ISO string, with or without seconds', async () => {
		const schema = formSchema(withField(z.iso.datetime()), 'create');

		expect(await outcome(schema, { value: '2024-01-08T23:30' })).toEqual({
			value: { value: '2024-01-08T23:30:00.000Z' }
		});
		expect(await outcome(schema, { value: '2024-01-08T23:30:15' })).toEqual({
			value: { value: '2024-01-08T23:30:15.000Z' }
		});
	});

	it('reports a date or datetime that is no real date as an issue, never an error', async () => {
		const datetime = formSchema(withField(z.iso.datetime()), 'create');
		const date = formSchema(withField(z.date()), 'create');

		expect((await outcome(datetime, { value: '2024-13-45T10:00' })).issues).toEqual([
			expect.stringMatching(/^value: /)
		]);
		expect((await outcome(date, { value: '2024-13-45' })).issues).toEqual([
			expect.stringMatching(/^value: /)
		]);
	});

	it("reports the schema's own message for a bad value", async () => {
		expect(await outcome(formSchema(users, 'create'), { ...filledUser, email: 'ada' })).toEqual({
			issues: ['email: Enter a valid email address']
		});
		expect(
			(await outcome(formSchema(users, 'create'), { ...filledUser, role: 'owner' })).issues
		).toEqual([expect.stringMatching(/^role: Invalid option/)]);
	});

	it("keeps a required Field's own message for a missing value when the schema sets one", async () => {
		const named = withField(z.string({ error: 'Give it a name' }));
		expect(await outcome(formSchema(named, 'create'), { value: '' })).toEqual({
			issues: ['value: Give it a name']
		});
	});

	it('reports a number input that is not a number, and drops keys the form has no input for', async () => {
		const servings = withField(z.number());

		expect((await outcome(formSchema(servings, 'create'), { value: Number.NaN })).issues).toEqual([
			expect.stringMatching(/^value: /)
		]);
		expect(await outcome(formSchema(servings, 'create'), { value: 4, extra: 'x' })).toEqual({
			value: { value: 4 }
		});
	});
});

describe('formSchema for the edit form', () => {
	it('gives the validated editable Fields, with the hidden id as the typed id', async () => {
		expect(await outcome(formSchema(users, 'edit'), { ...filledUser, id: '7' })).toEqual({
			value: {
				id: 7,
				name: 'Ada Lovelace',
				email: 'ada@example.com',
				role: 'admin',
				active: true,
				joinedAt: '2024-03-01T09:30:00.000Z'
			}
		});
	});

	it('reads a number id that the browser sent as a number', async () => {
		expect(await outcome(formSchema(users, 'edit'), { ...filledUser, id: 7 })).toEqual({
			value: expect.objectContaining({ id: 7 })
		});
	});

	it('keeps a string id as it is', async () => {
		const pages = defineResource({
			name: 'pages',
			label: 'Pages',
			schema: z.object({ id: z.string(), title: z.string() })
		});
		expect(await outcome(formSchema(pages, 'edit'), { id: 'about/team', title: 'Team' })).toEqual({
			value: { id: 'about/team', title: 'Team' }
		});
	});

	it.each([
		['text for a number id', 'abc'],
		['a number not written canonically', '01'],
		['an empty id', ''],
		['no id at all', undefined]
	])('reports %s as invalid input', async (_, id) => {
		expect(await outcome(formSchema(users, 'edit'), { ...filledUser, id })).toEqual({
			issues: ['id: Invalid input']
		});
	});

	it('reports an invalid id together with the issues of the Fields', async () => {
		expect(
			await outcome(formSchema(users, 'edit'), { ...filledUser, name: '', id: 'abc' })
		).toEqual({ issues: ['id: Invalid input', 'name: Required'] });
	});

	it('leaves a cleared optional Field out, so the Provider removes its value', async () => {
		const result = await outcome(formSchema(users, 'edit'), { ...filledUser, age: '', id: '7' });
		expect(result).toEqual({ value: expect.not.objectContaining({ age: expect.anything() }) });
	});
});

describe('toFormValues', () => {
	/** The edit form's input values for a record of a Resource with one Field, `value`. */
	const valuesOf = (schema: z.ZodType, value: unknown) => {
		const resource = withField(schema);
		return toFormValues(toFormSpec(resource, 'edit'), { id: 1, value });
	};

	it('gives text, numbers, booleans and enum options as the inputs show them', () => {
		expect(valuesOf(z.string(), 'Ada')).toEqual({ value: 'Ada' });
		expect(valuesOf(z.number(), 4.5)).toEqual({ value: 4.5 });
		expect(valuesOf(z.boolean(), true)).toEqual({ value: true });
		expect(valuesOf(z.boolean(), false)).toEqual({ value: false });
		expect(valuesOf(z.enum(['Easy', 'Hard']), 'Hard')).toEqual({ value: 'Hard' });
	});

	it('writes a number option as the select writes it', () => {
		expect(valuesOf(z.enum({ One: 1, Two: 2 }), 2)).toEqual({ value: '2' });
	});

	it('writes a datetime in UTC to the minute, with seconds only when it has them', () => {
		expect(valuesOf(z.iso.datetime(), '2024-03-01T23:30:00.000Z')).toEqual({
			value: '2024-03-01T23:30'
		});
		expect(valuesOf(z.iso.datetime(), '2024-03-01T23:30:15Z')).toEqual({
			value: '2024-03-01T23:30:15'
		});
		expect(valuesOf(z.iso.datetime(), '2024-03-01T23:30:15.250Z')).toEqual({
			value: '2024-03-01T23:30:15.250'
		});
	});

	it('writes a date as its day, in UTC for a Date', () => {
		expect(valuesOf(z.iso.date(), '2024-01-08')).toEqual({ value: '2024-01-08' });
		expect(valuesOf(z.date(), new Date(Date.UTC(2024, 0, 8)))).toEqual({ value: '2024-01-08' });
	});

	it('leaves out a Field with no value', () => {
		expect(valuesOf(z.string().optional(), undefined)).toEqual({});
		expect(valuesOf(z.string().nullable(), null)).toEqual({});
	});

	it('never gives the id, which the edit form carries as a hidden input', () => {
		expect(valuesOf(z.string(), 'Ada')).not.toHaveProperty('id');
	});

	// The demo's Resources, cut down to the scalar Fields the forms edit so far, each with a
	// record shaped like the demo backend's seed.
	const demo = [
		{
			resource: defineResource({
				name: 'recipes',
				label: 'Recipes',
				schema: z.object({
					id: z.number(),
					name: z.string(),
					cuisine: z.string(),
					difficulty: z.enum(['Easy', 'Medium', 'Hard']),
					prepTimeMinutes: field(z.number(), { label: 'Prep time (min)' }),
					servings: z.number(),
					caloriesPerServing: field(z.number(), { label: 'Calories' }).optional(),
					vegetarian: z.boolean(),
					reviewCount: z.number(),
					publishedAt: z.iso.datetime(),
					instructions: field(z.string(), { list: false, description: 'How to cook it' })
				})
			}),
			records: [
				{
					id: 1,
					name: 'Classic Margherita Pizza',
					cuisine: 'Italian',
					difficulty: 'Easy',
					prepTimeMinutes: 20,
					servings: 4,
					caloriesPerServing: 300,
					vegetarian: true,
					reviewCount: 97,
					publishedAt: '2024-01-08T10:00:00.000Z',
					instructions: 'Stretch the dough.'
				},
				{
					id: 2,
					name: 'Beef Bourguignon',
					cuisine: 'French',
					difficulty: 'Hard',
					prepTimeMinutes: 45,
					servings: 6,
					vegetarian: false,
					reviewCount: 0,
					publishedAt: '2024-02-08T10:00:00.000Z',
					instructions: 'Brown the beef.'
				}
			]
		},
		{
			resource: defineResource({
				name: 'posts',
				label: 'Posts',
				schema: z.object({
					id: z.number(),
					title: z.string(),
					userId: field(z.number(), { label: 'Author ID' }),
					status: z.enum(['draft', 'published']),
					body: field(z.string(), { list: false })
				})
			}),
			records: [{ id: 3, title: 'On testing', userId: 2, status: 'draft', body: 'Notes.' }]
		},
		{
			resource: defineResource({
				name: 'users',
				label: 'Users',
				schema: z.object({
					id: z.number(),
					name: z.string(),
					email: z.email(),
					phone: z.string().optional(),
					role: z.enum(['admin', 'editor', 'viewer']),
					active: z.boolean(),
					joinedAt: z.iso.datetime()
				})
			}),
			records: [
				{
					id: 1,
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					phone: '+44 20 7946 0001',
					role: 'admin',
					active: true,
					joinedAt: '2023-01-15T09:00:00.000Z'
				},
				{
					id: 4,
					name: 'Katherine Johnson',
					email: 'katherine@example.com',
					role: 'editor',
					active: false,
					joinedAt: '2023-04-15T09:00:00.000Z'
				}
			]
		}
	];

	const cases = demo.flatMap(({ resource, records }) =>
		records.map((record): [string, Resource, { id: number }] => [
			`${resource.name} ${record.id}`,
			resource,
			record
		])
	);

	it.each(cases)('round-trips through the edit form schema for %s', async (_, resource, record) => {
		const values = toFormValues(toFormSpec(resource, 'edit'), record);

		expect(
			await outcome(formSchema(resource, 'edit'), { ...values, id: String(record.id) })
		).toEqual({ value: record });
	});
});
