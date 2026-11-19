// Kinds that convert a Field's value between what its input sends and what the schema checks:
// `fromInput` on the forms' way in, `toInput` for the edit form's prefill, the startup checks
// that come with them, and how `serveResource`'s forms find them on the server (`adminHooks`).
import type { Component } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	defineAdmin,
	defineResource,
	field,
	formSchema,
	toFormSpec,
	toFormValues,
	type AdminKinds,
	type KindRegistry,
	type Resource,
	type ResourceRemote,
	type StandardSchemaV1
} from '@svelte-admin/core';
import { adminHooks, handleError, servedFormSchema } from '@svelte-admin/core/hooks';

// The remote functions only run inside a SvelteKit app; these tests never call them.
const remote = async () => ({}) as unknown as ResourceRemote;
const component = async () => ({ default: (() => {}) as unknown as Component });

/** Digits are a number, a slug is text, and anything else is refused. */
const fromInput = vi.fn((raw: string) => {
	const text = raw.trim();
	if (/^\d+$/.test(text)) return Number(text);
	if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(text)) return text;
	throw new Error('Enter a number or a slug, such as 42 or abc-1');
});
const toInput = vi.fn((value: unknown) => String(value));

/** The app's Kinds: `numberOrSlug` converts, `stars` (declared in kinds.test-d.ts) doesn't. */
const kinds = {
	numberOrSlug: { input: component, fromInput, toInput },
	stars: { cell: component }
} satisfies AdminKinds;

const numberOrSlug = () => z.union([z.number(), z.string()]);

// A union has no built-in input: naming a Kind lets `defineResource` pass it.
const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		name: z.string(),
		sourceId: field(numberOrSlug(), { kind: 'numberOrSlug', label: 'Source ID' }),
		altId: field(numberOrSlug(), { kind: 'numberOrSlug' }).optional(),
		// A number has a built-in input, but its Kind's conversion still runs first.
		servings: field(z.number().max(10, 'At most 10'), { kind: 'numberOrSlug' })
	})
});

/** Run a form schema on raw input, as Kit does with what the browser sent. */
async function outcome(schema: StandardSchemaV1<unknown, unknown>, input: Record<string, unknown>) {
	const result = await schema['~standard'].validate(input);
	if (result.issues === undefined) return { value: result.value };
	return {
		issues: result.issues.map(
			(issue) => `${(issue.path ?? []).map(String).join('.')}: ${issue.message}`
		)
	};
}

const filled = { name: 'Pizza', sourceId: '42', servings: '4' };

describe('formSchema with a Kind that converts', () => {
	const create = formSchema(recipes, 'create', kinds) as StandardSchemaV1<unknown, unknown>;

	it('converts what the input sent with `fromInput`: digits to a number, a slug to text', async () => {
		expect(await outcome(create, filled)).toEqual({
			value: { name: 'Pizza', sourceId: 42, servings: 4 }
		});
		expect(await outcome(create, { ...filled, sourceId: 'abc-1', altId: '7' })).toEqual({
			value: { name: 'Pizza', sourceId: 'abc-1', altId: 7, servings: 4 }
		});
	});

	it('treats an empty input as no value, without calling `fromInput`', async () => {
		fromInput.mockClear();
		expect(await outcome(create, { ...filled, sourceId: '', altId: '' })).toEqual({
			issues: ['sourceId: Required']
		});
		expect(await outcome(create, { name: 'Pizza', servings: '4' })).toEqual({
			issues: ['sourceId: Required']
		});
		// Only `servings` was converted, once per run.
		expect(fromInput.mock.calls).toEqual([['4'], ['4']]);
	});

	it('converts before the schema validates, so the schema checks the converted value', async () => {
		expect(await outcome(create, { ...filled, servings: '12' })).toEqual({
			issues: ['servings: At most 10']
		});
		// A slug converts to text, which a number Field's schema then rejects.
		expect(await outcome(create, { ...filled, servings: 'four' })).toEqual({
			issues: [expect.stringMatching(/^servings: /)]
		});
	});

	it("turns a throw into an issue on the Field, with the thrown error's message", async () => {
		expect(await outcome(create, { ...filled, sourceId: 'abc 1' })).toEqual({
			issues: ['sourceId: Enter a number or a slug, such as 42 or abc-1']
		});
	});

	it('reports a throw beside the other issues, once per Field', async () => {
		const result = await outcome(create, { ...filled, name: '', sourceId: '?', altId: '!' });
		expect(result.issues?.toSorted()).toEqual([
			'altId: Enter a number or a slug, such as 42 or abc-1',
			'name: Required',
			'sourceId: Enter a number or a slug, such as 42 or abc-1'
		]);
	});

	it('reads a thrown value that is no Error as "Invalid input"', async () => {
		const throwsText = {
			numberOrSlug: {
				input: component,
				fromInput: () => {
					throw 'nope';
				}
			}
		} satisfies AdminKinds;
		const schema = formSchema(recipes, 'create', throwsText) as StandardSchemaV1<unknown, unknown>;
		expect(await outcome(schema, filled)).toEqual({
			issues: ['sourceId: Invalid input', 'servings: Invalid input']
		});
	});

	it('converts on the edit form too, beside the id', async () => {
		const edit = formSchema(recipes, 'edit', kinds) as StandardSchemaV1<unknown, unknown>;
		expect(await outcome(edit, { ...filled, id: '3', sourceId: '9001' })).toEqual({
			value: { id: 3, name: 'Pizza', sourceId: 9001, servings: 4 }
		});
	});

	it('leaves the value as sent when the Kind has no `fromInput`, or without the Kinds', async () => {
		const noConversion = formSchema(recipes, 'create', {
			numberOrSlug: { input: component }
		}) as StandardSchemaV1<unknown, unknown>;
		expect(await outcome(noConversion, { ...filled, servings: 4 })).toEqual({
			value: { name: 'Pizza', sourceId: '42', servings: 4 }
		});
		const withoutKinds = formSchema(recipes, 'create') as StandardSchemaV1<unknown, unknown>;
		expect(await outcome(withoutKinds, { ...filled, servings: 4 })).toEqual({
			value: { name: 'Pizza', sourceId: '42', servings: 4 }
		});
	});
});

describe('toFormValues with a Kind that converts', () => {
	const spec = toFormSpec(recipes, 'edit');

	it('writes the value as the input shows it, with `toInput`', () => {
		expect(toFormValues(spec, { id: 1, name: 'Pizza', sourceId: 42, servings: 4 }, kinds)).toEqual({
			name: 'Pizza',
			sourceId: '42',
			servings: '4'
		});
	});

	it('skips a missing value without calling `toInput`', () => {
		toInput.mockClear();
		expect(toFormValues(spec, { id: 1, name: 'Pizza', servings: 4, altId: null }, kinds)).toEqual({
			name: 'Pizza',
			servings: '4'
		});
		expect(toInput.mock.calls).toEqual([[4]]);
	});

	it('round-trips through formSchema: the prefill saves the same record', async () => {
		const edit = formSchema(recipes, 'edit', kinds) as StandardSchemaV1<unknown, unknown>;
		for (const record of [
			{ id: 1, name: 'Pizza', sourceId: 42, servings: 4 },
			{ id: 2, name: 'Soup', sourceId: 'dj-2', altId: 'x-1', servings: 2 }
		]) {
			const values = toFormValues(spec, record, kinds);
			expect(await outcome(edit, { ...values, id: String(record.id) })).toEqual({ value: record });
		}
	});
});

describe('the form spec of a Field with no built-in input that names a Kind', () => {
	it("is a custom input, which the Kind's input renders", () => {
		expect(toFormSpec(recipes, 'create').find((spec) => spec.key === 'sourceId')).toEqual({
			key: 'sourceId',
			label: 'Source ID',
			required: true,
			namedKind: 'numberOrSlug',
			kind: 'custom'
		});
	});
});

describe('defineAdmin, checking the Fields that need a Kind for their input', () => {
	const admin =
		(adminKinds: KindRegistry, resource: Resource = recipes) =>
		() =>
			defineAdmin({
				basePath: '/admin',
				resources: { [resource.name]: { resource, remote } },
				kinds: adminKinds as AdminKinds
			});

	it('passes a union Field that names an app Kind with an input', () => {
		expect(admin(kinds)).not.toThrow();
	});

	it('throws for one whose app Kind has no input, naming the Resource, the Field and the Kind', () => {
		expect(admin({ numberOrSlug: { cell: component } })).toThrow(
			'Resource "recipes": the Field "sourceId" has no form input for its type, and its Kind ' +
				'"numberOrSlug" has no `input` in admin.ts.'
		);
	});

	it('throws for one whose Kind admin.ts does not define, such as a Theme Kind', () => {
		expect(admin({})).toThrow('the Field "sourceId" has no form input for its type');
		expect(admin({})).toThrow('or mark the Field `readOnly: true` or `hidden: true`');
	});

	it('passes one that is read-only or hidden, which no form edits', () => {
		const owned = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				sourceId: field(numberOrSlug(), { kind: 'numberOrSlug', readOnly: true }),
				altId: field(numberOrSlug(), { kind: 'numberOrSlug', hidden: true }).optional()
			})
		});
		expect(admin({}, owned)).not.toThrow();
	});

	it("throws for one that is `readOnly: 'afterCreate'`, whose create form still needs an input", () => {
		const setOnce = defineResource({
			name: 'recipes',
			label: 'Recipes',
			schema: z.object({
				id: z.number(),
				sourceId: field(numberOrSlug(), { kind: 'numberOrSlug', readOnly: 'afterCreate' })
			})
		});
		expect(admin({}, setOnce)).toThrow('the Field "sourceId"');
	});

	it('still lets defineResource throw for one that names no Kind', () => {
		expect(() =>
			defineResource({
				name: 'recipes',
				label: 'Recipes',
				schema: z.object({ id: z.number(), sourceId: numberOrSlug() })
			})
		).toThrow('the Field "sourceId" has no form input for its type');
	});

	it.each(['fromInput', 'toInput'])('throws for %s on a built-in Kind', (conversion) => {
		expect(admin({ date: { [conversion]: (value: unknown) => value } })).toThrow(
			`admin.ts gives the built-in Kind "date" \`${conversion}\` in \`kinds\`. The core reads ` +
				"a built-in Kind's values itself, so only a named Kind may convert them. Remove it."
		);
	});
});

// One file, so these run in order: the server finds the Kinds once `adminHooks` has run.
describe('servedFormSchema, which serveResource validates its forms with', () => {
	const plain = defineResource({
		name: 'users',
		label: 'Users',
		schema: z.object({ id: z.number(), name: z.string() })
	});

	it('fails with an unexpected error naming the fix when no admin was given', async () => {
		const schema = servedFormSchema(recipes, 'create') as StandardSchemaV1<unknown, unknown>;
		expect(() => schema['~standard'].validate(filled)).toThrow(
			'The recipes form validates the Field "sourceId", which names the Kind "numberOrSlug", ' +
				'but no admin was given to the server. In src/hooks.server.ts, write ' +
				'`export const { handleError } = adminHooks(admin);`.'
		);
	});

	it('validates a form whose Fields name no Kind without one', async () => {
		const schema = servedFormSchema(plain, 'create') as StandardSchemaV1<unknown, unknown>;
		expect(await outcome(schema, { name: 'Ada' })).toEqual({ value: { name: 'Ada' } });
	});

	it("converts with the admin's Kinds once `adminHooks` has them, even a schema built before", async () => {
		const early = servedFormSchema(recipes, 'create') as StandardSchemaV1<unknown, unknown>;
		const hooks = adminHooks(
			defineAdmin({
				basePath: '/admin',
				resources: { recipes: { resource: recipes, remote } },
				kinds
			})
		);

		expect(hooks).toEqual({ handleError });
		expect(await outcome(early, filled)).toEqual({
			value: { name: 'Pizza', sourceId: 42, servings: 4 }
		});
	});
});
