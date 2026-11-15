// Type-level tests, checked by `tsc` (`bun run check`), never run. Each `@ts-expect-error`
// fails the check if the line below it stops being a type error.
import type { Component } from 'svelte';
import { z } from 'zod';
import { defineAdmin, defineResource, type Provider } from '@svelte-admin/core';
import { serveResource } from '@svelte-admin/core/server';
import {
	createListView,
	type ListSelection,
	type ListViewState,
	type ShellAdmin
} from '@svelte-admin/core/views';

const recipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() })
});

type Recipe = { id: number; name: string };

const recipeProvider: Provider<Recipe> = {
	getList: async () => ({ data: [{ id: 1, name: 'Classic Margherita Pizza' }], total: 1 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' })
};

const userProvider: Provider<{ id: number; email: string }> = {
	getList: async () => ({ data: [], hasNextPage: false }),
	getOne: async (_ctx, id) => ({ id, email: 'ada@example.com' })
};

// @ts-expect-error a Provider must be able to read one record
const listOnlyProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 })
};

// A Provider's ids have the schema's id type, never coerced.
const stringIdProvider: Provider<Recipe, string> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id: Number(id), name: 'Coerced' })
};

// A Provider whose records match the schema is accepted, and what it serves fits admin.ts.
const recipesRemote = serveResource(recipes, recipeProvider);
const admin = defineAdmin({
	basePath: '/admin',
	resources: { recipes: { resource: recipes, remote: async () => recipesRemote } }
});

// @ts-expect-error a Resource cannot be served without a Provider
serveResource(recipes);

// @ts-expect-error the Provider's records must match the Resource schema
serveResource(recipes, userProvider);

// @ts-expect-error the Provider must take the schema's id type: a number for recipes
serveResource(recipes, stringIdProvider);

// The remote getOne takes the canonical id type and gives a record of the schema's type.
const recipe: Promise<Recipe> = recipesRemote.getOne(1);
// @ts-expect-error a recipe id is a number, so '1' is not one
void recipesRemote.getOne('1');
void recipe;
void listOnlyProvider;

// A string id is fine too.
defineResource({ name: 'posts', label: 'Posts', schema: z.object({ id: z.string() }) });

defineResource({
	name: 'notes',
	label: 'Notes',
	// @ts-expect-error the schema must have an `id` Field
	schema: z.object({ title: z.string() })
});

defineResource({
	name: 'flags',
	label: 'Flags',
	// @ts-expect-error the `id` Field must be a string or a number
	schema: z.object({ id: z.boolean() })
});

defineResource({
	name: 'tags',
	label: 'Tags',
	// @ts-expect-error the `id` Field must not coerce ('1' and 1 would both become ids)
	schema: z.object({ id: z.coerce.number() })
});

defineResource({
	name: 'drafts',
	label: 'Drafts',
	// @ts-expect-error the `id` Field must not be optional
	schema: z.object({ id: z.number().optional() })
});

// An icon is a lazy import of a component that takes a `class`, as a Lucide icon does.
type IconLike = Component<{ class?: string | null; size?: number | string; title?: string }>;
defineResource({
	name: 'chefs',
	label: 'Chefs',
	icon: async () => ({ default: {} as IconLike }),
	schema: z.object({ id: z.number() })
});
defineResource({
	name: 'cooks',
	label: 'Cooks',
	// @ts-expect-error an icon is a lazy import, not the component itself
	icon: {} as IconLike,
	schema: z.object({ id: z.number() })
});

// `locate` keeps each Resource's id type.
const here = admin.locate('/admin/recipes/1');
if (here?.name === 'recipes') {
	const id: number | undefined = here.id;
	// @ts-expect-error a recipe id is a number
	const text: string | undefined = here.id;
	void id;
	void text;
}

// The admin `defineAdmin` returns is what the shell takes.
const shellAdmin: ShellAdmin = admin;
void shellAdmin;

// A list View's selection keeps the Resource's canonical id type: recipe ids stay numbers.
declare const recipeList: ListViewState<typeof recipes>;
const selected: number[] = recipeList.selection.ids;
recipeList.selection.toggle(1);
recipeList.selection.setAll([1, 2], true);
// @ts-expect-error a recipe id is a number, so '1' can't be selected
recipeList.selection.toggle('1');
// @ts-expect-error nor can a page of string ids
recipeList.selection.setAll(['1', '2'], true);
// @ts-expect-error the selected ids are numbers, not strings
const selectedText: string[] = recipeList.selection.ids;
void selected;
void selectedText;

// A Resource with string ids gets a selection of strings.
const slugged = defineResource({
	name: 'pages',
	label: 'Pages',
	schema: z.object({ id: z.string() })
});
declare const pageList: ListViewState<typeof slugged>;
const pageSelection: ListSelection<string> = pageList.selection;
// @ts-expect-error a page id is a string
pageList.selection.has(1);
void pageSelection;
void slugged;

// A list View made for one Resource is what the Theme's parts take (they accept any Resource's
// list View), so an app's replaced View can hand its own straight to them. (The value from
// `createListView` itself, not `ListViewState<typeof recipes>`, which TypeScript compares by
// its type argument alone.)
const replacedView = createListView(recipes, recipesRemote);
const anyList: ListViewState = replacedView;
void anyList;
