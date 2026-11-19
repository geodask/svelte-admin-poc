import { describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { z } from 'zod';
import {
	assertNamedKinds,
	defineAdmin,
	defineResource,
	field,
	kindComponent,
	toFormSpec,
	type KindComponents,
	type KindRegistry,
	type ResourceRemote
} from '@svelte-admin/core';

// The remote functions only run inside a SvelteKit app; these tests never call them.
const remote = async () => ({}) as unknown as ResourceRemote;

/** A stand-in for a lazy import of a component, named so a test can tell which one it got. */
const lazy = (name: string) => {
	const load = async () => ({ default: (() => {}) as unknown as Component });
	return Object.assign(load, { displayName: name });
};
const nameOf = (component: unknown) =>
	(component as { displayName?: string } | undefined)?.displayName;

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		name: z.string(),
		rating: field(z.int().min(1).max(5), {
			kind: 'stars',
			sortable: true,
			filterable: true
		}).optional(),
		vegetarian: z.boolean(),
		publishedAt: z.iso.datetime(),
		nutrition: z.object({ proteinGrams: z.number() }),
		userId: field(z.number(), { ref: () => users })
	})
});

const fieldOf = (key: string) => recipes.fields.find((f) => f.key === key)!;
const specOf = (key: string) => {
	const spec = toFormSpec(recipes, 'create').find((s) => s.key === key)!;
	if (spec.kind === 'readOnly') throw new Error(`${key} is read-only`);
	return spec;
};

describe('a Field that names a Kind', () => {
	it('keeps its built-in Kind, so sorting, filtering and export still follow its schema', () => {
		expect(fieldOf('rating')).toMatchObject({
			kind: 'number',
			namedKind: 'stars',
			sortable: true,
			filterOperators: ['eq', 'lt', 'lte', 'gt', 'gte']
		});
		expect(fieldOf('name')).not.toHaveProperty('namedKind');
	});

	it('names it whichever side of `.optional()` `field()` sits', () => {
		const inside = defineResource({
			name: 'things',
			label: 'Things',
			schema: z.object({ id: z.number(), rating: field(z.number().optional(), { kind: 'stars' }) })
		});
		expect(inside.fields[1]).toMatchObject({ kind: 'number', namedKind: 'stars', required: false });
	});
});

describe('kindComponent, which component renders a Field in a slot', () => {
	const app: KindRegistry = {
		stars: { cell: lazy('app stars cell') },
		boolean: { cell: lazy('app boolean cell') },
		date: { display: lazy('app date display'), input: lazy('app date input') }
	};
	const theme: KindRegistry = {
		stars: { cell: lazy('theme stars cell'), display: lazy('theme stars display') },
		mood: { input: lazy('theme mood input') }
	};

	it("takes the app's Kind of the Field's named Kind first", () => {
		expect(nameOf(kindComponent('cell', fieldOf('rating'), app, theme))).toBe('app stars cell');
	});

	it("takes the Theme's Kind of that name for a slot the app's Kind leaves out", () => {
		expect(nameOf(kindComponent('display', fieldOf('rating'), app, theme))).toBe(
			'theme stars display'
		);
	});

	it('falls back to the built-in rendering for a slot neither Kind gives', () => {
		expect(kindComponent('input', fieldOf('rating'), app, theme)).toBeUndefined();
		expect(kindComponent('input', specOf('rating'), app, theme)).toBeUndefined();
	});

	it("takes the Theme's Kind without the app's", () => {
		expect(nameOf(kindComponent('cell', fieldOf('rating'), undefined, theme))).toBe(
			'theme stars cell'
		);
	});

	it("replaces a built-in Kind's components per slot, for every Field of that Kind", () => {
		expect(nameOf(kindComponent('cell', fieldOf('vegetarian'), app, theme))).toBe(
			'app boolean cell'
		);
		// The app's boolean Kind gives only a cell: the display stays the Theme's built-in one.
		expect(kindComponent('display', fieldOf('vegetarian'), app, theme)).toBeUndefined();
		expect(nameOf(kindComponent('display', fieldOf('publishedAt'), app, theme))).toBe(
			'app date display'
		);
		expect(kindComponent('cell', fieldOf('publishedAt'), app, theme)).toBeUndefined();
		expect(kindComponent('cell', fieldOf('name'), app, theme)).toBeUndefined();
	});

	it("prefers the Field's named Kind, the Theme's too, over a replaced built-in Kind", () => {
		const replacesNumber: KindRegistry = { number: { cell: lazy('app number cell') } };
		expect(nameOf(kindComponent('cell', fieldOf('rating'), replacesNumber, theme))).toBe(
			'theme stars cell'
		);
		// A slot the named Kind leaves out falls back to the replaced built-in Kind.
		expect(nameOf(kindComponent('cell', fieldOf('rating'), replacesNumber, {}))).toBe(
			'app number cell'
		);
	});

	it("finds an input spec's built-in Kind from its input: a checkbox is a boolean, a datetime a date", () => {
		const inputs: KindRegistry = {
			boolean: { input: lazy('app boolean input') },
			date: { input: lazy('app date input') }
		};
		expect(nameOf(kindComponent('input', specOf('vegetarian'), inputs, theme))).toBe(
			'app boolean input'
		);
		expect(nameOf(kindComponent('input', specOf('publishedAt'), inputs, theme))).toBe(
			'app date input'
		);
		expect(kindComponent('input', specOf('name'), inputs, theme)).toBeUndefined();
	});

	it('never replaces an object or a Reference, whatever the registries hold', () => {
		const fixed = {
			object: { display: lazy('object display') },
			reference: { cell: lazy('reference cell') }
		} as KindRegistry;
		expect(kindComponent('display', fieldOf('nutrition'), fixed, fixed)).toBeUndefined();
		expect(kindComponent('cell', fieldOf('userId'), fixed, fixed)).toBeUndefined();
	});
});

describe('defineAdmin with Kinds', () => {
	const stars: KindComponents = { cell: lazy('stars cell') };

	it('exposes the Kinds as `admin.kinds`, and none as `{}`', () => {
		const admin = defineAdmin({
			basePath: '/admin',
			resources: { recipes: { resource: recipes, remote }, users: { resource: users, remote } },
			kinds: { stars }
		});
		expect(admin.kinds).toEqual({ stars });
		expect(defineAdmin({ basePath: '/admin', resources: {} }).kinds).toEqual({});
	});

	it.each(['object', 'reference'])('refuses to replace the built-in Kind %j', (name) => {
		expect(() =>
			defineAdmin({
				basePath: '/admin',
				resources: {},
				kinds: { [name]: { cell: lazy('cell') } } as never
			})
		).toThrow(new RegExp(`the Kind "${name}" in \`kinds\`, which can't be replaced`));
	});
});

describe('assertNamedKinds, the check that every named Kind is defined', () => {
	const admin = (kinds: KindRegistry) =>
		defineAdmin({
			basePath: '/admin',
			resources: { recipes: { resource: recipes, remote }, users: { resource: users, remote } },
			kinds
		});

	it("passes when the app's Kinds or the Theme's define each named Kind", () => {
		expect(() => assertNamedKinds(admin({ stars: {} }), {})).not.toThrow();
		expect(() => assertNamedKinds(admin({}), { stars: { cell: lazy('cell') } })).not.toThrow();
	});

	it('fails naming the Resource, the Field and the Kind when neither does', () => {
		expect(() => assertNamedKinds(admin({ boolean: {} }), { mood: {} })).toThrow(
			'Resource "recipes": the Field "rating" names the Kind "stars", which neither the Theme ' +
				"nor admin.ts defines. Add it to the admin's `kinds`."
		);
	});

	it('does not take an inherited key for a Kind', () => {
		const sneaky = defineResource({
			name: 'sneaky',
			label: 'Sneaky',
			schema: z.object({ id: z.number(), value: field(z.string(), { kind: 'toString' as never }) })
		});
		const withSneaky = defineAdmin({
			basePath: '/admin',
			resources: { sneaky: { resource: sneaky, remote } }
		});
		expect(() => assertNamedKinds(withSneaky, {})).toThrow(/"toString"/);
	});
});
