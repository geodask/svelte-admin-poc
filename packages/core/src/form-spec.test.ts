import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	field,
	formSchema,
	rowCount,
	toFormSpec,
	toFormValues,
	withoutRow,
	type Resource,
	type StandardSchemaV1
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
	it("names the Field's named Kind on its input spec, beside its built-in input", () => {
		expect(specOf(field(z.int(), { kind: 'stars' }).optional())).toEqual({
			key: 'value',
			label: 'Value',
			required: false,
			namedKind: 'stars',
			kind: 'number',
			integer: true
		});
		expect(specOf(z.int())).not.toHaveProperty('namedKind');
	});

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

	it('gives a long text Field a textarea with `input: "textarea"`, and ignores it elsewhere', () => {
		expect(specOf(field(z.string(), { input: 'textarea' }))).toMatchObject({ kind: 'textarea' });
		expect(specOf(field(z.string(), { input: 'textarea' }).optional())).toMatchObject({
			kind: 'textarea',
			required: false
		});
		expect(specOf(field(z.number(), { input: 'textarea' }))).toMatchObject({ kind: 'number' });
	});

	describe('maps an array of scalars to a list', () => {
		it('with one input per item by default', () => {
			expect(specOf(z.array(z.string()))).toEqual({
				key: 'value',
				label: 'Value',
				required: false,
				kind: 'list',
				mode: 'rows',
				item: { key: 'value', label: 'Value', required: true, kind: 'text', format: 'text' }
			});
		});

		it('with one item per line with `input: "lines"`, or one input per item with "rows"', () => {
			expect(specOf(field(z.array(z.string()), { input: 'lines' }))).toMatchObject({
				kind: 'list',
				mode: 'lines'
			});
			expect(specOf(field(z.array(z.string()), { input: 'rows' }))).toMatchObject({
				kind: 'list',
				mode: 'rows'
			});
		});

		it('of any scalar type with an input, one input per item', () => {
			expect(specOf(z.array(z.int()))).toMatchObject({
				kind: 'list',
				mode: 'rows',
				item: { kind: 'number', integer: true }
			});
			expect(specOf(z.array(z.enum(['a', 'b'])))).toMatchObject({
				kind: 'list',
				item: { kind: 'select', options: ['a', 'b'] }
			});
			expect(specOf(z.array(z.email()))).toMatchObject({
				kind: 'list',
				item: { kind: 'text', format: 'email' }
			});
		});

		it('keeps one input per item for a list that is not text, even with `input: "lines"`', () => {
			expect(specOf(field(z.array(z.number()), { input: 'lines' }))).toMatchObject({
				kind: 'list',
				mode: 'rows'
			});
		});

		it('required only when it must have an item, and never through a wrapper', () => {
			expect(specOf(z.array(z.string()).min(1))).toMatchObject({ kind: 'list', required: true });
			expect(specOf(z.array(z.string()).min(1).optional())).toMatchObject({
				kind: 'list',
				required: false
			});
		});
	});

	it('maps an array of objects to rows, one fieldset per item with an input per Field', () => {
		const ingredients = z
			.array(
				z.object({
					name: z.string(),
					quantity: field(z.string(), { label: 'Amount' }).optional()
				})
			)
			.min(1, 'Add at least one ingredient');

		expect(specOf(ingredients)).toEqual({
			key: 'value',
			label: 'Value',
			required: true,
			kind: 'rows',
			fields: [
				{ key: 'name', label: 'Name', required: true, kind: 'text', format: 'text' },
				{ key: 'quantity', label: 'Amount', required: false, kind: 'text', format: 'text' }
			]
		});
	});

	it('maps a nested object to a group, with an input per Field and its own wrappers', () => {
		const nutrition = z.object({ proteinGrams: z.number(), carbsGrams: z.int().optional() });

		expect(specOf(nutrition)).toEqual({
			key: 'value',
			label: 'Value',
			required: true,
			kind: 'group',
			fields: [
				{
					key: 'proteinGrams',
					label: 'Protein grams',
					required: true,
					kind: 'number',
					integer: false
				},
				{ key: 'carbsGrams', label: 'Carbs grams', required: false, kind: 'number', integer: true }
			]
		});
		expect(specOf(nutrition.optional())).toMatchObject({ kind: 'group', required: false });
	});

	it('maps lists and groups inside rows and groups', () => {
		const spec = specOf(
			z.object({
				steps: z.array(z.object({ text: z.string(), tags: z.array(z.string()) }))
			})
		);

		expect(spec).toMatchObject({
			kind: 'group',
			fields: [
				{
					key: 'steps',
					kind: 'rows',
					fields: [
						{ key: 'text', kind: 'text' },
						{ key: 'tags', kind: 'list', mode: 'rows' }
					]
				}
			]
		});
	});
});

describe('defineResource, checking every Field the forms would edit has an input', () => {
	const define = (sourceId: z.ZodType) => () =>
		defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({ id: z.number(), name: z.string(), sourceId })
		});
	const union = () => z.union([z.string(), z.number()]);

	it('throws for a required union Field that is neither read-only nor hidden, naming both', () => {
		expect(define(union())).toThrow(
			'Resource "recipes": the Field "sourceId" has no form input for its type.'
		);
		expect(define(union())).toThrow('Mark it `readOnly: true` or `hidden: true`');
	});

	it('throws for an optional one too', () => {
		expect(define(union().optional())).toThrow('the Field "sourceId"');
	});

	it('accepts it when it is read-only or hidden, inside or outside a wrapper', () => {
		expect(define(field(union(), { readOnly: true }))).not.toThrow();
		expect(define(field(union(), { hidden: true }))).not.toThrow();
		expect(define(field(union(), { readOnly: true }).optional())).not.toThrow();
	});

	it("throws for one that is `readOnly: 'afterCreate'`, since create still needs its input", () => {
		expect(define(field(union(), { readOnly: 'afterCreate' }))).toThrow(
			"`readOnly: 'afterCreate'` still needs one on create"
		);
	});

	it.each([
		['a record', z.record(z.string(), z.string())],
		['a list of booleans', z.array(z.boolean())],
		['a list of unions', z.array(z.union([z.string(), z.number()]))],
		['rows with a Field it has no input for', z.array(z.object({ id: union() }))],
		[
			'a group with a Field it has no input for',
			z.object({ meta: z.record(z.string(), z.string()) })
		]
	])('throws for %s, since it could not be saved whole', (_, schema) => {
		expect(define(schema)).toThrow('the Field "sourceId"');
		expect(define(field(schema, { readOnly: true }))).not.toThrow();
	});

	it('never checks the id, which no form edits', () => {
		expect(() =>
			defineResource({ name: 'things', label: 'Things', schema: z.object({ id: z.number() }) })
		).not.toThrow();
	});
});

/** Run a form schema on raw input, as Kit does with what the browser sent. */
async function validate(
	schema: StandardSchemaV1<unknown, unknown>,
	input: Record<string, unknown>
) {
	return schema['~standard'].validate(input);
}

/** The issues of a failed validation as `path: message`, or the value when it passed. */
async function outcome(schema: StandardSchemaV1<unknown, unknown>, input: Record<string, unknown>) {
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
	it('reads a number sent as text, as a radio group sends it, and leaves other text to the schema', async () => {
		const rating = withField(field(z.int().min(1).max(5), { kind: 'stars' }).optional());

		expect(await outcome(formSchema(rating, 'create'), { value: '4' })).toEqual({
			value: { value: 4 }
		});
		expect(await outcome(formSchema(rating, 'create'), { value: ' 2 ' })).toEqual({
			value: { value: 2 }
		});
		// "None" sends empty text: no value, so an optional rating is left out.
		expect(await outcome(formSchema(rating, 'create'), { value: '' })).toEqual({ value: {} });
		for (const text of ['4a', '0x4', '1e3', '-']) {
			expect((await outcome(formSchema(rating, 'create'), { value: text })).issues).toEqual([
				expect.stringMatching(/^value: /)
			]);
		}
		expect((await outcome(formSchema(rating, 'create'), { value: '9' })).issues).toEqual([
			expect.stringMatching(/^value: /)
		]);
	});

	it('leaves text for a number Field that names no Kind to the schema, as its input sends a number', async () => {
		const servings = withField(z.number());
		expect((await outcome(formSchema(servings, 'create'), { value: '4' })).issues).toEqual([
			expect.stringMatching(/^value: /)
		]);
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

describe('formSchema for lists, rows and groups', () => {
	const posts = defineResource({
		name: 'posts',
		label: 'Posts',
		schema: z.object({
			id: z.number(),
			title: z.string(),
			tags: z.array(z.string().min(2, 'Use at least two letters'))
		})
	});

	const lined = defineResource({
		name: 'posts',
		label: 'Posts',
		schema: z.object({
			id: z.number(),
			tags: field(z.array(z.string().min(2, 'Use at least two letters')), { input: 'lines' })
		})
	});

	const recipes = defineResource({
		name: 'recipes',
		label: 'Recipes',
		schema: z.object({
			id: z.number(),
			ingredients: z
				.array(z.object({ name: z.string(), quantity: z.string().optional() }))
				.min(1, 'Add at least one ingredient'),
			nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }).optional()
		})
	});

	const flour = { name: 'Flour', quantity: '200 g' };

	it('drops the blank rows of a list, wherever they are', async () => {
		expect(
			await outcome(formSchema(posts, 'create'), {
				title: 'T',
				tags: ['', 'Pizza', '', 'Quick', '']
			})
		).toEqual({ value: { title: 'T', tags: ['Pizza', 'Quick'] } });
	});

	it('gives an empty list when every row is blank, or the list sent nothing', async () => {
		expect(await outcome(formSchema(posts, 'create'), { title: 'T', tags: [''] })).toEqual({
			value: { title: 'T', tags: [] }
		});
		expect(await outcome(formSchema(posts, 'create'), { title: 'T' })).toEqual({
			value: { title: 'T', tags: [] }
		});
	});

	it('reports an issue of one item under that item, counting the rows as the form shows them', async () => {
		expect(
			await outcome(formSchema(posts, 'create'), { title: 'T', tags: ['', 'Pizza', 'x', ''] })
		).toEqual({ issues: ['tags.2: Use at least two letters'] });
	});

	it('splits lines into an array, trimming each and dropping blank lines', async () => {
		expect(
			await outcome(formSchema(lined, 'create'), { tags: 'Pizza\n\n  Quick \r\nVegan\n' })
		).toEqual({ value: { tags: ['Pizza', 'Quick', 'Vegan'] } });
		expect(await outcome(formSchema(lined, 'create'), { tags: '' })).toEqual({
			value: { tags: [] }
		});
	});

	it('reports an issue of one line on the whole textarea, which is its only input', async () => {
		expect(await outcome(formSchema(lined, 'create'), { tags: 'Pizza\nx' })).toEqual({
			issues: ['tags: Use at least two letters']
		});
	});

	it('drops the blank rows of an array of objects, and keeps a row with any value', async () => {
		expect(
			await outcome(formSchema(recipes, 'create'), {
				ingredients: [flour, { name: '', quantity: '' }, { name: 'Salt', quantity: '' }, {}]
			})
		).toEqual({ value: { ingredients: [flour, { name: 'Salt' }] } });
	});

	it("reports a rule about the whole list on the list, with the schema's message", async () => {
		expect(
			await outcome(formSchema(recipes, 'create'), { ingredients: [{ name: '', quantity: '' }] })
		).toEqual({ issues: ['ingredients: Add at least one ingredient'] });
	});

	it("reports an issue in a row under that row's input, counting the rows as the form shows them", async () => {
		expect(
			await outcome(formSchema(recipes, 'create'), {
				ingredients: [{ name: '', quantity: '' }, flour, { name: '', quantity: '2 cups' }, {}]
			})
		).toEqual({ issues: ['ingredients.2.name: Required'] });
	});

	it('treats an all-blank optional group as no value', async () => {
		const blank = { proteinGrams: undefined, carbsGrams: undefined };
		expect(
			await outcome(formSchema(recipes, 'create'), { ingredients: [flour], nutrition: blank })
		).toEqual({ value: { ingredients: [flour] } });
		expect(await outcome(formSchema(recipes, 'create'), { ingredients: [flour] })).toEqual({
			value: { ingredients: [flour] }
		});
	});

	it('requires the required Fields of an optional group once the group has any value', async () => {
		expect(
			await outcome(formSchema(recipes, 'create'), {
				ingredients: [flour],
				nutrition: { proteinGrams: 12, carbsGrams: undefined }
			})
		).toEqual({ issues: ['nutrition.carbsGrams: Required'] });
		expect(
			await outcome(formSchema(recipes, 'create'), {
				ingredients: [flour],
				nutrition: { proteinGrams: 12, carbsGrams: 40 }
			})
		).toEqual({ value: { ingredients: [flour], nutrition: { proteinGrams: 12, carbsGrams: 40 } } });
	});

	it('reports each required Field of a required group that is left blank', async () => {
		const required = withField(z.object({ proteinGrams: z.number(), carbsGrams: z.number() }));
		expect(await outcome(formSchema(required, 'create'), { value: {} })).toEqual({
			issues: ['value.proteinGrams: Required', 'value.carbsGrams: Required']
		});
	});

	it('normalises the inputs inside rows and groups as it does at the top level', async () => {
		const things = withField(
			z.object({
				when: z.date(),
				done: z.boolean(),
				note: z.string().nullable(),
				levels: z.array(z.object({ level: z.enum({ Low: 1, High: 2 }), on: z.boolean() }))
			})
		);

		expect(
			await outcome(formSchema(things, 'create'), {
				value: {
					when: '2024-01-08',
					note: '',
					levels: [{ level: '2' }, {}, { level: '1', on: true }]
				}
			})
		).toEqual({
			value: {
				value: {
					when: new Date(Date.UTC(2024, 0, 8)),
					done: false,
					note: null,
					levels: [
						{ level: 2, on: false },
						{ level: 1, on: true }
					]
				}
			}
		});
	});

	it('writes the line breaks of a textarea as the browser shows them, whatever it sent', async () => {
		const notes = withField(field(z.string(), { input: 'textarea' }));
		expect(
			await outcome(formSchema(notes, 'create'), { value: 'Stretch the dough.\r\nBake it hot.' })
		).toEqual({ value: { value: 'Stretch the dough.\nBake it hot.' } });
	});
});

describe('formSchema for read-only and hidden Fields', () => {
	const accounts = defineResource({
		name: 'accounts',
		label: 'Accounts',
		schema: z.object({
			id: z.number(),
			name: z.string(),
			email: field(z.email(), { readOnly: 'afterCreate' }),
			loginCount: field(z.number(), { readOnly: true }),
			source: field(z.union([z.string(), z.number()]), { readOnly: true }),
			notes: field(z.string(), { hidden: true })
		})
	});
	const crafted = { name: 'Ada', email: 'ada@example.com', loginCount: '99', notes: 'Set' };

	it('validates create without read-only and hidden Fields, but with `afterCreate` ones', async () => {
		expect(await outcome(formSchema(accounts, 'create'), { ...crafted, source: 'x' })).toEqual({
			value: { name: 'Ada', email: 'ada@example.com' }
		});
	});

	it('validates edit without read-only, hidden or `afterCreate` Fields', async () => {
		expect(await outcome(formSchema(accounts, 'edit'), { ...crafted, id: '3' })).toEqual({
			value: { id: 3, name: 'Ada' }
		});
	});

	it('never requires them: they are left out of the schema, not ignored after it', async () => {
		expect(await outcome(formSchema(accounts, 'create'), { name: '' })).toEqual({
			issues: ['name: Required', 'email: Required']
		});
		expect(await outcome(formSchema(accounts, 'edit'), { id: '3', name: 'Ada' })).toEqual({
			value: { id: 3, name: 'Ada' }
		});
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

	it('writes a list as its items then one blank row, or as lines', () => {
		expect(valuesOf(z.array(z.string()), ['Pizza', 'Quick'])).toEqual({
			value: ['Pizza', 'Quick', '']
		});
		expect(valuesOf(z.array(z.string()), [])).toEqual({ value: [''] });
		expect(valuesOf(z.array(z.enum({ One: 1, Two: 2 })), [2])).toEqual({ value: ['2', ''] });
		expect(valuesOf(field(z.array(z.string()), { input: 'lines' }), ['Pizza', 'Quick'])).toEqual({
			value: 'Pizza\nQuick'
		});
	});

	it('writes rows as one set of values per item then one blank row', () => {
		const ingredients = z.array(z.object({ name: z.string(), quantity: z.string().optional() }));
		expect(valuesOf(ingredients, [{ name: 'Flour', quantity: '200 g' }, { name: 'Salt' }])).toEqual(
			{ value: [{ name: 'Flour', quantity: '200 g' }, { name: 'Salt' }, {}] }
		);
	});

	it('writes a group as the values of its Fields, as their inputs show them', () => {
		const published = z.object({ at: z.iso.datetime(), proteinGrams: z.number().optional() });
		expect(valuesOf(published, { at: '2024-03-01T23:30:00.000Z' })).toEqual({
			value: { at: '2024-03-01T23:30' }
		});
	});

	it('leaves out a list or group with no value', () => {
		expect(valuesOf(z.array(z.string()).optional(), undefined)).toEqual({});
		expect(valuesOf(z.object({ a: z.string() }).nullable(), null)).toEqual({});
	});

	// The demo's Resources, each with a record shaped like the demo backend's seed, and the
	// Fields the edit form can't set.
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
					reviewCount: field(z.number(), { readOnly: true }),
					tags: field(z.array(z.string()), { input: 'lines' }),
					ingredients: z
						.array(z.object({ name: z.string(), quantity: z.string().optional() }))
						.min(1, 'Add at least one ingredient'),
					publishedAt: z.iso.datetime(),
					sourceId: field(z.union([z.string(), z.number()]), { readOnly: true }),
					nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
					instructions: field(z.string(), {
						list: false,
						description: 'How to cook it',
						input: 'textarea'
					}),
					internalNotes: field(z.string(), { hidden: true })
				})
			}),
			readOnly: ['reviewCount', 'sourceId', 'internalNotes'],
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
					tags: ['Pizza', 'Vegetarian'],
					ingredients: [{ name: 'Pizza dough', quantity: '1 ball' }, { name: 'Basil leaves' }],
					publishedAt: '2024-01-08T10:00:00.000Z',
					sourceId: 'dj-1',
					nutrition: { proteinGrams: 10, carbsGrams: 40 },
					instructions: 'Stretch the dough.\nBake it hot.',
					internalNotes: 'Imported batch 1'
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
					tags: [],
					ingredients: [{ name: 'Beef', quantity: '1 kg' }],
					publishedAt: '2024-02-08T10:00:00.000Z',
					sourceId: 9001,
					nutrition: { proteinGrams: 30.5, carbsGrams: 0 },
					instructions: 'Brown the beef.',
					internalNotes: 'Imported batch 1'
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
					tags: z.array(z.string()),
					body: field(z.string(), { list: false })
				})
			}),
			readOnly: [],
			records: [
				{
					id: 3,
					title: 'On testing',
					userId: 2,
					status: 'draft',
					tags: ['Guide', 'Testing'],
					body: 'Notes.'
				},
				{ id: 4, title: 'Untagged', userId: 1, status: 'published', tags: [], body: 'None.' }
			]
		},
		{
			resource: defineResource({
				name: 'users',
				label: 'Users',
				schema: z.object({
					id: z.number(),
					name: z.string(),
					email: field(z.email(), { readOnly: 'afterCreate' }),
					phone: z.string().optional(),
					role: z.enum(['admin', 'editor', 'viewer']),
					active: z.boolean(),
					joinedAt: z.iso.datetime()
				})
			}),
			readOnly: ['email'],
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

	const cases = demo.flatMap(({ resource, readOnly, records }) =>
		records.map((record): [string, Resource, string[], { id: number }] => [
			`${resource.name} ${record.id}`,
			resource,
			readOnly,
			record
		])
	);

	it.each(cases)(
		'round-trips the editable Fields through the edit form schema for %s',
		async (_, resource, readOnly, record) => {
			const values = toFormValues(toFormSpec(resource, 'edit'), record);
			const editable = Object.fromEntries(
				Object.entries(record).filter(([key]) => !readOnly.includes(key))
			);

			expect(Object.keys(values).some((key) => readOnly.includes(key))).toBe(false);
			expect(
				await outcome(formSchema(resource, 'edit'), { ...values, id: String(record.id) })
			).toEqual({ value: editable });
		}
	);
});

describe('rowCount', () => {
	it('is one row per item up to the last with a value, then one blank row', () => {
		expect(rowCount(['Pizza', 'Quick', ''])).toBe(3);
		expect(rowCount(['Pizza', '', 'Quick'])).toBe(4);
		expect(rowCount(['Pizza', '', '', ''])).toBe(2);
		expect(rowCount([{ name: 'Flour' }, { name: '', quantity: '' }])).toBe(2);
		expect(rowCount([{ name: '' }, { quantity: '2 cups' }, {}])).toBe(3);
	});

	it('is the one blank row for a list with no items, or no value yet', () => {
		expect(rowCount([])).toBe(1);
		expect(rowCount(['', ''])).toBe(1);
		expect(rowCount(undefined)).toBe(1);
	});
});

describe('withoutRow', () => {
	it('gives the items without the one at an index', () => {
		expect(withoutRow(['Pizza', 'Quick', 'Vegan', ''], 1)).toEqual(['Pizza', 'Vegan', '']);
		expect(withoutRow([{ name: 'Flour' }, { name: 'Salt' }], 0)).toEqual([{ name: 'Salt' }]);
	});

	it('gives an empty list for no value', () => {
		expect(withoutRow(undefined, 0)).toEqual([]);
	});
});
