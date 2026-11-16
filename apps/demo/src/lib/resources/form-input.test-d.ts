// Type-level checks of the demo's own Resources, checked by svelte-check (`bun run check`), never
// run or imported. The core's `types.test-d.ts` covers the form types in general; these keep the
// demo's schemas honest. Each `@ts-expect-error` fails the check if its line stops being an error.
import type {
	CreateData,
	EditData,
	FormInput,
	IdOf,
	ListParams,
	Provider,
	RecordOf,
	Resource
} from '@svelte-admin/core';
import type { serveResource } from '@svelte-admin/core/server';
import type { posts } from './posts.ts';
import type { recipes } from './recipes.ts';
import type { users } from './users.ts';

type RecipeCreate = FormInput<typeof recipes, 'create'>;
type RecipeEdit = FormInput<typeof recipes, 'edit'>;

// No id, no Field the backend owns, and no hidden Field: on create...
// @ts-expect-error the backend assigns the id
export const recipeId: RecipeCreate['id'] = 1;
// @ts-expect-error the backend counts the reviews
export const recipeReviews: RecipeCreate['reviewCount'] = 0;
// @ts-expect-error the backend sets the source
export const recipeSource: RecipeCreate['sourceId'] = 'local-1';
// @ts-expect-error hidden Fields are in no form
export const recipeNotes: RecipeCreate['internalNotes'] = '';
// ...nor on edit, which carries the typed id instead.
export const recipeEditId: RecipeEdit['id'] = 1;
// @ts-expect-error the backend counts the reviews
export const recipeEditReviews: RecipeEdit['reviewCount'] = 0;

// `vegetarian` is a checkbox, so it may be left out.
export const recipeWithoutVegetarian: Pick<RecipeCreate, 'vegetarian'> = {};

// Users' email is set once, on create.
export const userEmail: FormInput<typeof users, 'create'>['email'] = 'lin@example.com';
// @ts-expect-error not on edit
export const userEditEmail: FormInput<typeof users, 'edit'>['email'] = 'lin@example.com';
export const userData: Pick<CreateData<typeof users>, 'email'> = { email: 'lin@example.com' };
// @ts-expect-error the Provider's `update` never gets it
export const userEditData: Pick<EditData<typeof users>, 'email'> = { email: 'lin@example.com' };

// Posts' views are counted by the backend.
// @ts-expect-error no form sets them
export const postViews: FormInput<typeof posts, 'create'>['viewCount'] = 0;

// List params follow each Resource's `searchable`: recipes and users take a search, posts don't.
export const recipeSearch: ListParams<typeof recipes>['search'] = 'pasta';
export const userSearch: ListParams<typeof users>['search'] = 'ada';
// @ts-expect-error posts aren't searchable
export const postSearch: ListParams<typeof posts>['search'] = 'hello';

// A Provider written for M2, whose `getList` takes the loose list params and reads a search,
// still fits `serveResource` for every demo Resource.
type M2Provider<R extends Resource> = Provider<RecordOf<R>, IdOf<R>, CreateData<R>, EditData<R>>;
// The rest of each Provider, which this check doesn't look at.
declare const writes: {
	recipes: Omit<M2Provider<typeof recipes>, 'getList'>;
	users: Omit<M2Provider<typeof users>, 'getList'>;
	posts: Omit<M2Provider<typeof posts>, 'getList'>;
};
const m2GetList = async (
	_ctx: unknown,
	{ page, perPage, search }: { page: number; perPage: number; search?: string }
) => ({ data: [], total: page + perPage + (search?.length ?? 0) });
type Served<R extends Resource> = Parameters<typeof serveResource<R>>[1];
export const recipesProvider: Served<typeof recipes> = { ...writes.recipes, getList: m2GetList };
export const usersProvider: Served<typeof users> = { ...writes.users, getList: m2GetList };
export const postsProvider: Served<typeof posts> = { ...writes.posts, getList: m2GetList };
