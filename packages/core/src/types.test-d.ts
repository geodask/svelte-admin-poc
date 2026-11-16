// Type-level tests, checked by `tsc` (`bun run check`), never run. Each `@ts-expect-error`
// fails the check if the line below it stops being a type error.
import { form } from '$app/server';
import type { Component } from 'svelte';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';
import {
	defineAdmin,
	defineResource,
	field,
	formSchema,
	type CreateData,
	type EditData,
	type FormInput,
	type IdOf,
	type ListParams,
	type ListSort,
	type Provider,
	type ProviderContext,
	type RecordOf,
	type RemoteFormFieldLike,
	type RemoteFormLike,
	type Resource,
	type ResourceProvider,
	type ResourceRemote,
	type SortableKey,
	type StandardSchemaV1
} from '@svelte-admin/core';
import { restProvider } from '@svelte-admin/core/rest';
import { serveResource } from '@svelte-admin/core/server';
import {
	createFormView,
	createListView,
	type BulkDeleteResult,
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
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	// `create` gets the record without its id, and returns it with the id the backend assigned.
	create: async (_ctx, data) => ({ id: 2, ...data }),
	// `update` gets the typed id and every editable Field, and returns the saved record.
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	// `deleteOne` gets the typed id, and returns nothing.
	deleteOne: async () => {}
};

const userProvider: Provider<{ id: number; email: string }> = {
	getList: async () => ({ data: [], hasNextPage: false }),
	getOne: async (_ctx, id) => ({ id, email: 'ada@example.com' }),
	create: async (_ctx, data) => ({ id: 1, ...data }),
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	deleteOne: async () => {}
};

// @ts-expect-error a Provider must be able to read one record
const listOnlyProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	deleteOne: async () => {}
};

// @ts-expect-error a Provider must be able to create a record
const readOnlyProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	deleteOne: async () => {}
};

// @ts-expect-error a Provider must be able to update a record
const createOnlyProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	deleteOne: async () => {}
};

// @ts-expect-error a Provider must be able to delete a record
const undeletableProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	update: async (_ctx, { id, data }) => ({ id, ...data })
};

const sneakyProvider: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	// @ts-expect-error `create` never receives an id: the backend assigns it
	create: async (_ctx, data) => ({ id: data.id, name: data.name }),
	// @ts-expect-error `update` gets the id beside the data, never inside it
	update: async (_ctx, { data }) => ({ id: data.id, name: data.name }),
	deleteOne: async () => {}
};

const textIdUpdate: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	// @ts-expect-error a recipe id arrives as a number, never as text
	update: async (_ctx, { id, data }: { id: string; data: { name: string } }) => ({
		id: Number(id),
		...data
	}),
	deleteOne: async () => {}
};

const textIdDelete: Provider<Recipe> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Classic Margherita Pizza' }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	// @ts-expect-error a recipe id arrives as a number, never as text
	deleteOne: async (_ctx, id: string) => void id.trim()
};
void undeletableProvider;
void textIdDelete;
void readOnlyProvider;
void createOnlyProvider;
void sneakyProvider;
void textIdUpdate;

// A Provider's ids have the schema's id type, never coerced.
const stringIdProvider: Provider<Recipe, string> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id: Number(id), name: 'Coerced' }),
	create: async (_ctx, data) => ({ id: 2, ...data }),
	update: async (_ctx, { id, data }) => ({ id: Number(id), ...data }),
	deleteOne: async () => {}
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

// The remote deleteOne takes the canonical id type too, and fits the remote the Views take.
const recipesDelete: ResourceRemote<Recipe, number>['deleteOne'] = recipesRemote.deleteOne;
void recipesDelete(1);
// @ts-expect-error a recipe id is a number, so '1' is not one
void recipesRemote.deleteOne('1');
void recipe;
void listOnlyProvider;

// `deleteMany` is optional: every Provider above lacks it. One that has it gets typed ids.
const bulkProvider: Provider<Recipe> = {
	...recipeProvider,
	deleteMany: async (_ctx, ids) => void ids.map((id) => id.toFixed())
};
serveResource(recipes, bulkProvider);

const textIdBulk: Provider<Recipe> = {
	...recipeProvider,
	// @ts-expect-error recipe ids arrive as numbers, never as text
	deleteMany: async (_ctx, ids: string[]) => void ids.map((id) => id.trim())
};
void textIdBulk;

// The remote deleteMany takes an array of canonical ids, reports how many were deleted, and
// fits the remote the Views take.
const recipesDeleteMany: ResourceRemote<Recipe, number>['deleteMany'] = recipesRemote.deleteMany;
const report: Promise<{ deleted: number } | { deleted: number; failure: { message: string } }> =
	recipesDeleteMany([1, 2]).updates(recipesRemote.getList);
void report;
// @ts-expect-error recipe ids are numbers
void recipesRemote.deleteMany(['1']);
// @ts-expect-error it takes an array of ids, not one
void recipesRemote.deleteMany(1);

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
// Its bulk delete reports how many were deleted, whether it succeeded or not.
const bulkDelete: Promise<BulkDeleteResult> = replacedView.deleteSelected();
void bulkDelete.then((result) => result.deleted.toFixed());

// `recordTitle` as a key must name one of the schema's Fields.
const products = defineResource({
	name: 'products',
	label: 'Products',
	schema: z.object({ id: z.number(), sku: z.string(), price: z.number().optional() }),
	recordTitle: 'sku'
});
defineResource({
	name: 'products',
	label: 'Products',
	schema: z.object({ id: z.number(), sku: z.string() }),
	// @ts-expect-error products have no `name` Field
	recordTitle: 'name'
});

// As a function, it gets the record's own type and must return text.
defineResource({
	name: 'products',
	label: 'Products',
	schema: z.object({ id: z.number(), sku: z.string(), price: z.number().optional() }),
	recordTitle: (product) => {
		const sku: string = product.sku;
		const price: number | undefined = product.price;
		// @ts-expect-error a product has no `name`
		void product.name;
		void price;
		return sku;
	}
});
defineResource({
	name: 'products',
	label: 'Products',
	schema: z.object({ id: z.number(), sku: z.string() }),
	// @ts-expect-error a Record title is text, not a number
	recordTitle: (product) => product.id
});

// A Resource with a `recordTitle` still counts as a Resource, so the admin and the helpers take it.
const anyResource: Resource = products;
const productList: ListViewState = createListView(
	products,
	{} as ResourceRemote<RecordOf<typeof products>, IdOf<typeof products>>
);
void anyResource;
void productList;

// ---------------------------------------------------------------------------------------------
// Typed form input: what a replaced create or edit View's `fields` are typed from, and what the
// Provider's writes receive. The Resources mirror the demo's recipes and users.

const formRecipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { placeholder: 'e.g. Classic Margherita Pizza' }),
		difficulty: z.enum(['Easy', 'Medium', 'Hard']),
		servings: z.number(),
		caloriesPerServing: field(z.number(), { label: 'Calories' }).optional(),
		vegetarian: z.boolean(),
		tags: field(z.array(z.string()), { input: 'lines' }),
		ingredients: z
			.array(z.object({ name: z.string(), quantity: z.string().optional() }))
			.min(1, 'Add at least one ingredient'),
		reviewCount: field(z.number(), { readOnly: true }),
		publishedAt: z.iso.datetime(),
		sourceId: field(z.union([z.string(), z.number()]), { readOnly: true }),
		nutrition: z.object({ proteinGrams: z.number(), carbsGrams: z.number() }),
		instructions: field(z.string(), { input: 'textarea' }),
		internalNotes: field(z.string(), { hidden: true })
	})
});

const formUsers = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({
		id: z.number(),
		name: z.string(),
		email: field(z.email(), { readOnly: 'afterCreate' }),
		phone: z.string().optional(),
		active: z.boolean()
	})
});

// Each editable Field maps to what its input sends: text for a string, an enum, a date and a
// list in lines, a number for a number, an array for a list in rows, and nested values for rows
// and a group. Booleans are optional, since an unchecked checkbox sends nothing. The id and the
// read-only and hidden Fields are left out.
expectTypeOf<FormInput<typeof formRecipes, 'create'>>().toEqualTypeOf<{
	name: string;
	difficulty: string;
	servings: number;
	caloriesPerServing?: number;
	vegetarian?: boolean;
	tags: string;
	ingredients: { name: string; quantity?: string }[];
	publishedAt: string;
	nutrition: { proteinGrams: number; carbsGrams: number };
	instructions: string;
}>();
expectTypeOf<FormInput<typeof formRecipes, 'create'>>().not.toHaveProperty('id');
expectTypeOf<FormInput<typeof formRecipes, 'create'>>().not.toHaveProperty('reviewCount');
expectTypeOf<FormInput<typeof formRecipes, 'create'>>().not.toHaveProperty('sourceId');
expectTypeOf<FormInput<typeof formRecipes, 'create'>>().not.toHaveProperty('internalNotes');
expectTypeOf<FormInput<typeof formRecipes, 'edit'>>().not.toHaveProperty('reviewCount');
expectTypeOf<FormInput<typeof formRecipes, 'edit'>>().not.toHaveProperty('internalNotes');

// An `'afterCreate'` Field is on the create form only. The edit form carries the record's typed
// id as its hidden input instead, which also types `update.for(id)`.
expectTypeOf<FormInput<typeof formUsers, 'create'>>().toEqualTypeOf<{
	name: string;
	email: string;
	phone?: string;
	active?: boolean;
}>();
expectTypeOf<FormInput<typeof formUsers, 'edit'>>().toEqualTypeOf<{
	id: number;
	name: string;
	phone?: string;
	active?: boolean;
}>();

// The form schema's Standard Schema types are `FormInput` in, and the Provider's data out.
type SchemaInput<S> = S extends StandardSchemaV1<infer I, unknown> ? I : never;
type SchemaOutput<S> = S extends StandardSchemaV1<unknown, infer O> ? O : never;
const recipeCreateSchema = formSchema(formRecipes, 'create');
const userEditSchema = formSchema(formUsers, 'edit');
void recipeCreateSchema;
void userEditSchema;
expectTypeOf<SchemaInput<typeof recipeCreateSchema>>().toEqualTypeOf<
	FormInput<typeof formRecipes, 'create'>
>();
expectTypeOf<SchemaOutput<typeof recipeCreateSchema>>().toEqualTypeOf<
	CreateData<typeof formRecipes>
>();
expectTypeOf<SchemaInput<typeof userEditSchema>>().toEqualTypeOf<
	FormInput<typeof formUsers, 'edit'>
>();
expectTypeOf<SchemaOutput<typeof userEditSchema>>().toEqualTypeOf<
	EditData<typeof formUsers> & { id: number }
>();

// `CreateData` and `EditData` are the record as the schema gives it, minus what the form leaves out.
expectTypeOf<CreateData<typeof formRecipes>>().toEqualTypeOf<{
	name: string;
	difficulty: 'Easy' | 'Medium' | 'Hard';
	servings: number;
	caloriesPerServing?: number | undefined;
	vegetarian: boolean;
	tags: string[];
	ingredients: { name: string; quantity?: string | undefined }[];
	publishedAt: string;
	nutrition: { proteinGrams: number; carbsGrams: number };
	instructions: string;
}>();
expectTypeOf<CreateData<typeof formUsers>>().toEqualTypeOf<{
	name: string;
	email: string;
	phone?: string | undefined;
	active: boolean;
}>();
expectTypeOf<EditData<typeof formUsers>>().toEqualTypeOf<{
	name: string;
	phone?: string | undefined;
	active: boolean;
}>();

// Kit's `form()` takes the form schema as it is: every boolean in its input is optional.
const recipeForm = form(formSchema(formRecipes, 'create'), async (data) => {
	const name: string = data.name;
	// @ts-expect-error the backend owns `reviewCount`, so the form never gives it
	void data.reviewCount;
	void name;
});
// `fields` is typed from the Resource.
const nameField = recipeForm.fields.name.as('text');
void nameField;
// @ts-expect-error a read-only Field has no input on the form
void recipeForm.fields.reviewCount;
const userUpdate = form(formSchema(formUsers, 'edit'), async () => {});
// The edit form's instance is keyed by the record's typed id.
void userUpdate.for(1);
// @ts-expect-error a user id is a number
void userUpdate.for('1');
// @ts-expect-error users' email is set once, on create
void userUpdate.fields.email;

// The Provider's writes get exactly that data, and `serveResource` infers it from the Resource.
type FormRecipe = RecordOf<typeof formRecipes>;
const formRecipeProvider: Provider<
	FormRecipe,
	number,
	CreateData<typeof formRecipes>,
	EditData<typeof formRecipes>
> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async () => ({}) as FormRecipe,
	create: async (_ctx, data) => {
		// @ts-expect-error `create` never receives a Field the backend owns
		void data.reviewCount;
		return { ...data, id: 1, reviewCount: 0, sourceId: 'local-1', internalNotes: '' };
	},
	update: async (_ctx, { id, data }) => ({
		...data,
		id,
		reviewCount: 0,
		sourceId: 'local-1',
		internalNotes: ''
	}),
	deleteOne: async () => {}
};
serveResource(formRecipes, formRecipeProvider);
serveResource(formRecipes, restProvider('https://api.example.com').for(formRecipes));

// A Provider whose `create` expects data the form never sends is rejected.
const wrongCreateProvider = {
	...formRecipeProvider,
	create: async (
		_ctx: ProviderContext,
		data: CreateData<typeof formRecipes> & { reviewCount: number }
	) => ({ ...data, id: 1, sourceId: 'local-1', internalNotes: '' }) as FormRecipe
};
// @ts-expect-error `create` would need `reviewCount`, which the form never gives
serveResource(formRecipes, wrongCreateProvider);

// A Provider whose `update` expects users' email, set once on create, is rejected too.
type FormUser = RecordOf<typeof formUsers>;
const wrongUpdateProvider: Provider<FormUser> = {
	getList: async () => ({ data: [], total: 0 }),
	getOne: async (_ctx, id) => ({ id, name: 'Ada', email: 'ada@example.com', active: true }),
	create: async (_ctx, data) => ({ id: 1, ...data }),
	update: async (_ctx, { id, data }) => ({ id, ...data }),
	deleteOne: async () => {}
};
// @ts-expect-error `update` would need `email`, which the edit form never gives
serveResource(formUsers, wrongUpdateProvider);

// The brand survives `optional`, `nullable` and `default`, whether `field()` sits inside or
// outside them, as the runtime lookup does.
const wrapped = defineResource({
	name: 'wrapped',
	label: 'Wrapped',
	schema: z.object({
		id: z.string(),
		outerOptional: field(z.number(), { readOnly: true }).optional(),
		innerOptional: field(z.number().optional(), { readOnly: true }),
		outerNullable: field(z.string(), { hidden: true }).nullable(),
		innerDefault: field(z.string().default('draft'), { readOnly: 'afterCreate' }),
		outerDefault: field(z.boolean(), { readOnly: true }).default(false),
		twice: field(z.string(), { readOnly: 'afterCreate' }).optional().nullable(),
		chained: field(z.string(), { hidden: true }).min(1),
		labelled: field(z.string(), { label: 'Plain' }).optional()
	})
});
expectTypeOf<keyof FormInput<typeof wrapped, 'create'>>().toEqualTypeOf<
	'innerDefault' | 'twice' | 'labelled'
>();
expectTypeOf<keyof FormInput<typeof wrapped, 'edit'>>().toEqualTypeOf<'id' | 'labelled'>();
expectTypeOf<keyof CreateData<typeof wrapped>>().toEqualTypeOf<
	'innerDefault' | 'twice' | 'labelled'
>();
expectTypeOf<keyof EditData<typeof wrapped>>().toEqualTypeOf<'labelled'>();
void wrapped;
// `field()` still returns a schema of the same Zod type.
const plain: z.ZodOptional<z.ZodNumber> = field(z.number(), { readOnly: true }).optional();
void plain;

// `createFormView` keeps the remote form's type, so a replaced create or edit View gets typed
// `fields` from the remote functions `serveResource` returns.
const formRecipesRemote = serveResource(formRecipes, formRecipeProvider);
const recipeCreateView = createFormView(formRecipes, formRecipesRemote, 'create');
void recipeCreateView.form.fields.name.as('text');
void recipeCreateView.form.fields.servings.as('number');
void recipeCreateView.form.fields.vegetarian.as('checkbox');
void recipeCreateView.form.fields.ingredients[0].name.as('text');
// @ts-expect-error the backend owns `reviewCount`, so the create form has no input for it
void recipeCreateView.form.fields.reviewCount;
// @ts-expect-error hidden Fields are in no form
void recipeCreateView.form.fields.internalNotes;
// @ts-expect-error `servings` is a number input, not a text one
void recipeCreateView.form.fields.servings.as('text');

const formUsersRemote = serveResource(
	formUsers,
	{} as Provider<
		RecordOf<typeof formUsers>,
		number,
		CreateData<typeof formUsers>,
		EditData<typeof formUsers>
	>
);
const userEditView = createFormView(formUsers, formUsersRemote, 'edit', 1);
void userEditView.form.fields.id.as('hidden', 1);
void userEditView.form.fields.name.as('text');
// @ts-expect-error users' email is set once, on create, so the edit form has no input for it
void userEditView.form.fields.email;
// @ts-expect-error a user id is a number
createFormView(formUsers, formUsersRemote, 'edit', '1');

// The typed inputs are what the Theme's parts take for one Field, as are the untyped ones.
const typedInput: RemoteFormFieldLike = recipeCreateView.form.fields.name;
const typedRows: RemoteFormFieldLike = recipeCreateView.form.fields.ingredients;
const untypedInput: RemoteFormFieldLike = recipeCreateView.inputs.name;
void typedInput;
void typedRows;
void untypedInput;

// The Theme's stock Views, which take any Resource, get the untyped form.
const anyCreateView = createFormView(formRecipes as Resource, {} as ResourceRemote, 'create');
const looseForm: RemoteFormLike = anyCreateView.form;
void looseForm;

// ---------------------------------------------------------------------------------------------
// Typed list params: what `getList` receives, typed from the Resource as the form data is.

const searchableRecipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() }),
	searchable: true
});
const unsearchableRecipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() }),
	searchable: false
});

// A searchable Resource's list params have an optional search; one that isn't searchable has
// none, whether it says so or leaves `searchable` out.
expectTypeOf<ListParams<typeof searchableRecipes>>().toEqualTypeOf<{
	page: number;
	perPage: number;
	search?: string;
}>();
expectTypeOf<ListParams<typeof recipes>>().toEqualTypeOf<{ page: number; perPage: number }>();
expectTypeOf<ListParams<typeof unsearchableRecipes>>().toEqualTypeOf<{
	page: number;
	perPage: number;
}>();
// For a Resource TypeScript can't see, a search may come or not, and a sort on any Field.
expectTypeOf<ListParams>().toEqualTypeOf<{
	page: number;
	perPage: number;
	search?: string;
	sort?: { field: string; order: 'asc' | 'desc' };
}>();

// `serveResource` hands the Provider's `getList` the Resource's own list params.
serveResource(searchableRecipes, {
	...recipeProvider,
	getList: async (_ctx, params) => {
		expectTypeOf(params).toEqualTypeOf<ListParams<typeof searchableRecipes>>();
		return { data: [], total: 0 };
	}
});
serveResource(recipes, {
	...recipeProvider,
	getList: async (_ctx, params) => {
		expectTypeOf(params).toEqualTypeOf<{ page: number; perPage: number }>();
		return { data: [], total: 0 };
	}
});
serveResource(recipes, {
	...recipeProvider,
	// @ts-expect-error recipes aren't searchable here, so their `getList` never gets a search
	getList: async (_ctx, { search }) => ({ data: [], total: search === undefined ? 0 : 1 })
});

// A Provider whose `getList` takes the loose `ListParams`, as every Provider's did before they
// were typed from the Resource, still fits every Resource.
const looseListProvider: Provider<Recipe> = {
	...recipeProvider,
	getList: async (_ctx, { page, perPage, search }) => ({
		data: [],
		total: page + perPage + (search?.length ?? 0)
	})
};
serveResource(recipes, looseListProvider);
serveResource(searchableRecipes, looseListProvider);
serveResource(unsearchableRecipes, looseListProvider);

// `ResourceProvider` names what `serveResource` takes and the REST Provider returns.
expectTypeOf(restProvider('http://api.test').for(searchableRecipes)).toEqualTypeOf<
	ResourceProvider<typeof searchableRecipes>
>();

// The bundled REST Provider's `getList` is typed from the Resource too.
expectTypeOf(restProvider('http://api.test').for(searchableRecipes).getList)
	.parameter(1)
	.toEqualTypeOf<ListParams<typeof searchableRecipes>>();
expectTypeOf(restProvider('http://api.test').for(recipes).getList)
	.parameter(1)
	.toEqualTypeOf<{ page: number; perPage: number }>();

// So is the remote `getList`: a search only for a searchable Resource.
const searchableRemote = serveResource(searchableRecipes, recipeProvider);
void searchableRemote.getList({ page: 1, perPage: 25, search: 'pasta' });
void recipesRemote.getList({ page: 1, perPage: 25 });
// @ts-expect-error recipes here aren't searchable
void recipesRemote.getList({ page: 1, perPage: 25, search: 'pasta' });

// And a list View's `params`.
expectTypeOf(createListView(searchableRecipes, searchableRemote).params).toEqualTypeOf<
	ListParams<typeof searchableRecipes>
>();
expectTypeOf(replacedView.params).toEqualTypeOf<{ page: number; perPage: number }>();

// ---------------------------------------------------------------------------------------------
// Sortable Fields: a typed sort in the list params.

const sortableRecipes = defineResource({
	name: 'recipes',
	label: 'Recipes',
	searchable: true,
	schema: z.object({
		id: z.number(),
		name: field(z.string(), { sortable: true, label: 'Name' }),
		cuisine: field(z.string(), { label: 'Cuisine' }),
		// The brand survives the wrappers, on either side of `field()`.
		outerOptional: field(z.number(), { sortable: true }).optional(),
		innerOptional: field(z.number().optional(), { sortable: true }),
		outerNullable: field(z.iso.datetime(), { sortable: true }).nullable(),
		outerDefault: field(z.boolean(), { sortable: true }).default(false),
		twice: field(z.enum(['a', 'b']), { sortable: true })
			.optional()
			.nullable(),
		// Hidden Fields may be sortable too.
		hiddenSortable: field(z.string(), { hidden: true, sortable: true }),
		readOnlyPlain: field(z.number(), { readOnly: true })
	})
});

// `sort.field` is the union of the sortable Fields' keys.
expectTypeOf<SortableKey<typeof sortableRecipes>>().toEqualTypeOf<
	| 'name'
	| 'outerOptional'
	| 'innerOptional'
	| 'outerNullable'
	| 'outerDefault'
	| 'twice'
	| 'hiddenSortable'
>();
expectTypeOf<ListParams<typeof sortableRecipes>>().toEqualTypeOf<{
	page: number;
	perPage: number;
	search?: string;
	sort?: ListSort<
		| 'name'
		| 'outerOptional'
		| 'innerOptional'
		| 'outerNullable'
		| 'outerDefault'
		| 'twice'
		| 'hiddenSortable'
	>;
}>();
// A Resource with no sortable Field has no `sort`, searchable or not.
expectTypeOf<SortableKey<typeof searchableRecipes>>().toEqualTypeOf<never>();
expectTypeOf<keyof ListParams<typeof searchableRecipes>>().toEqualTypeOf<
	'page' | 'perPage' | 'search'
>();
const sortableOnly = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({ id: field(z.number(), { sortable: true }), title: z.string() })
});
expectTypeOf<ListParams<typeof sortableOnly>>().toEqualTypeOf<{
	page: number;
	perPage: number;
	sort?: { field: 'id'; order: 'asc' | 'desc' };
}>();

// The Provider's `getList` gets the typed sort from `serveResource` and the REST Provider.
const sortableRecipesProvider = restProvider('http://api.test').for(sortableRecipes);
serveResource(sortableRecipes, {
	...sortableRecipesProvider,
	getList: async (_ctx, params) => {
		expectTypeOf(params.sort).toEqualTypeOf<
			ListSort<SortableKey<typeof sortableRecipes>> | undefined
		>();
		return { data: [], total: 0 };
	}
});
serveResource(sortableOnly, {
	...restProvider('http://api.test').for(sortableOnly),
	// @ts-expect-error posts here only sort by id, so a Provider can't be written for a title sort
	getList: async (_ctx, params: { page: number; perPage: number; sort?: ListSort<'title'> }) => ({
		data: [],
		hasNextPage: params.sort === undefined
	})
});
// A Provider written against the loose `ListParams`, as before sorting, still fits.
serveResource(sortableRecipes, {
	...sortableRecipesProvider,
	getList: async (_ctx, { page, perPage, search }: ListParams) => ({
		data: [],
		total: page + perPage + (search?.length ?? 0)
	})
});

// The remote `getList` takes a sort only on a sortable Field.
const sortableRemote = serveResource(sortableRecipes, sortableRecipesProvider);
void sortableRemote.getList({ page: 1, perPage: 25, sort: { field: 'name', order: 'desc' } });
// @ts-expect-error `cuisine` isn't sortable
void sortableRemote.getList({ page: 1, perPage: 25, sort: { field: 'cuisine', order: 'asc' } });
// @ts-expect-error a sort is ascending or descending
void sortableRemote.getList({ page: 1, perPage: 25, sort: { field: 'name', order: 'up' } });
const sortableOnlyRemote = serveResource(
	sortableOnly,
	restProvider('http://api.test').for(sortableOnly)
);
// @ts-expect-error a Resource with no sortable Field takes no sort
void recipesRemote.getList({ page: 1, perPage: 25, sort: { field: 'name', order: 'asc' } });
void sortableOnlyRemote;

// A list View's sort state and hrefs take the sortable keys.
const sortableView = createListView(sortableRecipes, sortableRemote);
expectTypeOf(sortableView.params.sort).toEqualTypeOf<
	ListSort<SortableKey<typeof sortableRecipes>> | undefined
>();
expectTypeOf(sortableView.sortState('name')).toEqualTypeOf<'asc' | 'desc' | undefined>();
void sortableView.sortHref('outerOptional');

// ---------------------------------------------------------------------------------------------
// A Resource's default sort and page size.

const newestPostsSchema = z.object({
	id: field(z.number(), { sortable: true }),
	title: z.string(),
	createdAt: field(z.iso.datetime(), { hidden: true, sortable: true })
});
const newestPosts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	defaultSort: { field: 'id', order: 'desc' },
	perPage: 20
});
expectTypeOf(newestPosts.defaultSort).toEqualTypeOf<ListSort | undefined>();
expectTypeOf(newestPosts.perPage).toEqualTypeOf<number>();
// Neither setting changes the list params.
expectTypeOf<ListParams<typeof newestPosts>>().toEqualTypeOf<{
	page: number;
	perPage: number;
	sort?: ListSort<'id' | 'createdAt'>;
}>();
// A hidden Field may be the default sort, if it is sortable.
defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	defaultSort: { field: 'createdAt', order: 'asc' }
});
defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	// @ts-expect-error `title` isn't sortable, so it can't be the default sort
	defaultSort: { field: 'title', order: 'asc' }
});
defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	// @ts-expect-error posts have no `rating` Field
	defaultSort: { field: 'rating', order: 'asc' }
});
defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	// @ts-expect-error a sort is ascending or descending
	defaultSort: { field: 'id', order: 'down' }
});
defineResource({
	name: 'recipes',
	label: 'Recipes',
	schema: z.object({ id: z.number(), name: z.string() }),
	// @ts-expect-error a Resource with no sortable Field has no default sort
	defaultSort: { field: 'name', order: 'asc' }
});
defineResource({
	name: 'posts',
	label: 'Posts',
	schema: newestPostsSchema,
	// @ts-expect-error the page size is a number
	perPage: '20'
});
