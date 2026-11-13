import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defaultLabel, defineResource, detectKind, field } from '@svelte-admin/core';

describe('Kind detection', () => {
	it('detects text from a string', () => {
		expect(detectKind(z.string())).toEqual({ kind: 'text' });
	});

	it('detects text from an email or a url', () => {
		expect(detectKind(z.email())).toEqual({ kind: 'text' });
		expect(detectKind(z.string().email())).toEqual({ kind: 'text' });
		expect(detectKind(z.url())).toEqual({ kind: 'text' });
	});

	it('detects a number, including an integer', () => {
		expect(detectKind(z.number())).toEqual({ kind: 'number' });
		expect(detectKind(z.int())).toEqual({ kind: 'number' });
	});

	it('detects unknown for a type with no built-in Kind', () => {
		expect(detectKind(z.union([z.string(), z.number()]))).toEqual({ kind: 'unknown' });
		expect(detectKind(z.unknown())).toEqual({ kind: 'unknown' });
		expect(detectKind(z.record(z.string(), z.number()))).toEqual({ kind: 'unknown' });
		expect(detectKind(z.tuple([z.number(), z.number()]))).toEqual({ kind: 'unknown' });
	});

	it('detects a boolean', () => {
		expect(detectKind(z.boolean())).toEqual({ kind: 'boolean' });
	});

	it('detects a date, including a coerced date', () => {
		expect(detectKind(z.date())).toEqual({ kind: 'date' });
		expect(detectKind(z.coerce.date())).toEqual({ kind: 'date' });
	});

	it('detects a date from an ISO date or datetime string, since JSON carries dates as strings', () => {
		expect(detectKind(z.iso.date())).toEqual({ kind: 'date' });
		expect(detectKind(z.iso.datetime())).toEqual({ kind: 'date' });
	});

	it('detects an enum with its options in order', () => {
		expect(detectKind(z.enum(['Easy', 'Medium', 'Hard']))).toEqual({
			kind: 'enum',
			options: ['Easy', 'Medium', 'Hard']
		});
	});

	it('detects a list from an array of scalars', () => {
		expect(detectKind(z.array(z.string()))).toEqual({ kind: 'list' });
		expect(detectKind(z.array(z.number()))).toEqual({ kind: 'list' });
		expect(detectKind(z.array(z.enum(['a', 'b'])))).toEqual({ kind: 'list' });
		expect(detectKind(z.array(z.string().optional()))).toEqual({ kind: 'list' });
	});

	it('detects an object from a nested object or an array of objects', () => {
		expect(detectKind(z.object({ calories: z.number() }))).toEqual({ kind: 'object' });
		expect(detectKind(z.array(z.object({ step: z.string() })))).toEqual({ kind: 'object' });
	});

	it('detects unknown for an array of neither scalars nor objects', () => {
		expect(detectKind(z.array(z.array(z.string())))).toEqual({ kind: 'unknown' });
		expect(detectKind(z.array(z.unknown()))).toEqual({ kind: 'unknown' });
	});
});

describe('Kind detection through wrappers', () => {
	it('sees through optional, nullable and default, in any order', () => {
		expect(detectKind(z.number().optional())).toEqual({ kind: 'number' });
		expect(detectKind(z.boolean().nullable())).toEqual({ kind: 'boolean' });
		expect(detectKind(z.string().default('Italian'))).toEqual({ kind: 'text' });
		expect(detectKind(z.enum(['a', 'b']).nullable().optional())).toEqual({
			kind: 'enum',
			options: ['a', 'b']
		});
		expect(detectKind(z.array(z.string()).default([]).nullable())).toEqual({ kind: 'list' });
		expect(detectKind(z.iso.datetime().optional().default('2024-01-01T00:00:00Z'))).toEqual({
			kind: 'date'
		});
	});
});

describe('default labels', () => {
	it('turns a camelCase key into words in sentence case', () => {
		expect(defaultLabel('prepTimeMinutes')).toBe('Prep time minutes');
		expect(defaultLabel('name')).toBe('Name');
	});

	it('turns a snake_case key into words in sentence case', () => {
		expect(defaultLabel('prep_time_minutes')).toBe('Prep time minutes');
		expect(defaultLabel('created_at')).toBe('Created at');
	});

	it('keeps an acronym in capitals and writes an id as ID', () => {
		expect(defaultLabel('imageURL')).toBe('Image URL');
		expect(defaultLabel('HTTPStatus')).toBe('HTTP status');
		expect(defaultLabel('id')).toBe('ID');
		expect(defaultLabel('userId')).toBe('User ID');
		expect(defaultLabel('user_id')).toBe('User ID');
	});

	it('splits digits from letters', () => {
		expect(defaultLabel('address2')).toBe('Address 2');
	});
});

/** The Fields of a Resource with this shape plus a number id, without the id. */
function fieldsOf(shape: z.ZodRawShape) {
	const resource = defineResource({
		name: 'things',
		label: 'Things',
		schema: z.object({ id: z.number(), ...shape })
	});
	return resource.fields.filter((f) => f.key !== 'id');
}

const only = (shape: z.ZodRawShape) => fieldsOf(shape)[0];

describe("a Resource's Fields", () => {
	it('lists every Field in schema key order, with a default label and its Kind', () => {
		const resource = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				name: z.string(),
				difficulty: z.enum(['Easy', 'Hard']),
				prepTimeMinutes: z.number()
			})
		});

		expect(resource.fields.map((f) => [f.key, f.label, f.kind])).toEqual([
			['id', 'ID', 'number'],
			['name', 'Name', 'text'],
			['difficulty', 'Difficulty', 'enum'],
			['prepTimeMinutes', 'Prep time minutes', 'number']
		]);
		expect(resource.fields[2]).toMatchObject({ kind: 'enum', options: ['Easy', 'Hard'] });
	});

	it('uses the label and description set with field()', () => {
		expect(
			only({ servings: field(z.number(), { label: 'Serves', description: 'People' }) })
		).toMatchObject({
			label: 'Serves',
			description: 'People'
		});
	});

	it('keeps metadata set inside a wrapper: field(z.number(), { label }).optional()', () => {
		expect(only({ calories: field(z.number(), { label: 'X' }).optional() }).label).toBe('X');
		expect(only({ calories: field(z.number(), { label: 'X' }).nullable() }).label).toBe('X');
		expect(only({ calories: field(z.number(), { label: 'X' }).default(0) }).label).toBe('X');
		expect(only({ calories: field(z.number(), { label: 'X' }).optional().nullable() }).label).toBe(
			'X'
		);
	});

	it('finds metadata set outside a wrapper too', () => {
		expect(only({ calories: field(z.number().optional(), { label: 'X' }) }).label).toBe('X');
		expect(only({ calories: field(z.number().optional(), { label: 'X' }).nullable() }).label).toBe(
			'X'
		);
	});

	it('lets metadata set outside a wrapper win over metadata set inside it, key by key', () => {
		const inner = field(z.string(), { label: 'Inner', description: 'From inside' });

		expect(only({ notes: field(inner.optional(), { label: 'Outer' }) })).toMatchObject({
			label: 'Outer',
			description: 'From inside'
		});
	});

	it('shows a Field on the list and detail Views by default', () => {
		expect(only({ name: z.string() })).toMatchObject({ list: true, detail: true });
	});

	it('leaves a hidden Field out of every View', () => {
		expect(only({ secret: field(z.string(), { hidden: true }) })).toMatchObject({
			list: false,
			detail: false
		});
		expect(only({ secret: field(z.string(), { hidden: true }).optional() })).toMatchObject({
			list: false,
			detail: false
		});
	});

	it('leaves a `list: false` Field off the list View only', () => {
		expect(only({ instructions: field(z.string(), { list: false }) })).toMatchObject({
			list: false,
			detail: true
		});
	});

	it('leaves an object Field off the list View by default', () => {
		expect(only({ nutrition: z.object({ calories: z.number() }) })).toMatchObject({
			kind: 'object',
			list: false,
			detail: true
		});
	});

	it('reads requiredness from the whole wrapper chain', () => {
		const required = (schema: z.ZodType) => only({ value: schema }).required;

		expect(required(z.string())).toBe(true);
		expect(required(z.string().optional())).toBe(false);
		expect(required(z.string().nullable())).toBe(false);
		expect(required(z.string().default('x'))).toBe(false);
		// Only the inner wrapper makes it optional; the outer one alone would not.
		expect(required(z.string().optional().nullable())).toBe(false);
		expect(required(z.string().nullable().default(null))).toBe(false);
	});
});
