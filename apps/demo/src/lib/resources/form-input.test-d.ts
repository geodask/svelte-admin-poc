// Type-level checks of the demo's own Resources, checked by svelte-check (`bun run check`), never
// run or imported. The core's `types.test-d.ts` covers the form types in general; these keep the
// demo's schemas honest. Each `@ts-expect-error` fails the check if its line stops being an error.
import type { CreateData, EditData, FormInput } from '@svelte-admin/core';
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
