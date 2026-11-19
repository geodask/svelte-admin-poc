// Type-level checks of the demo's own Resources, checked by svelte-check (`bun run check`), never
// run or imported. The core's `types.test-d.ts` covers the form types in general; these keep the
// demo's schemas honest. Each `@ts-expect-error` fails the check if its line stops being an error.
import {
	field,
	type CreateData,
	type EditData,
	type FilterableKey,
	type FormInput,
	type IdOf,
	type ListFilter,
	type ListParams,
	type RecordOf,
	type Resource,
	type ResourceProvider,
	type ResourceRemote,
	type SortableKey
} from '@svelte-admin/core';
import type { serveResource } from '@svelte-admin/core/server';
import { z } from 'zod';
import type { posts } from './posts.ts';
import type { recipes } from './recipes.ts';
import { users } from './users.ts';

type RecipeCreate = FormInput<typeof recipes, 'create'>;
type RecipeEdit = FormInput<typeof recipes, 'edit'>;

// No id, no Field the backend owns, and no hidden Field: on create...
// @ts-expect-error the backend assigns the id
export const recipeId: RecipeCreate['id'] = 1;
// @ts-expect-error the backend counts the reviews
export const recipeReviews: RecipeCreate['reviewCount'] = 0;
// @ts-expect-error hidden Fields are in no form
export const recipeNotes: RecipeCreate['internalNotes'] = '';
// ...nor on edit, which carries the typed id instead.
export const recipeEditId: RecipeEdit['id'] = 1;
// @ts-expect-error the backend counts the reviews
export const recipeEditReviews: RecipeEdit['reviewCount'] = 0;

// `vegetarian` is a checkbox, so it may be left out.
export const recipeWithoutVegetarian: Pick<RecipeCreate, 'vegetarian'> = {};

// A recipe's rating names the app's `stars` Kind, whose radio group sends the rating as text, so
// its input is typed as text, on create and on edit, and may be left out ("None")...
export const recipeRatingInput: Exactly<RecipeCreate['rating'], string | undefined> = true;
export const recipeRatingEditInput: Exactly<RecipeEdit['rating'], string | undefined> = true;
// @ts-expect-error the radio group sends text, not a number
export const recipeRatingNumber: RecipeCreate['rating'] = 4;
// ...while the record, the Provider's data and the sort keep the schema's number.
export const recipeRating: Exactly<RecordOf<typeof recipes>['rating'], number | undefined> = true;
export const recipeRatingData: Exactly<CreateData<typeof recipes>['rating'], number | undefined> =
	true;
// A recipe's source id, a number or a slug, names the app's `numberOrSlug` Kind, whose text input
// makes it editable: its input is typed as text, on create and on edit...
export const recipeSourceInput: Exactly<RecipeCreate['sourceId'], string> = true;
export const recipeSourceEditInput: Exactly<RecipeEdit['sourceId'], string> = true;
// @ts-expect-error the text input sends text, which `fromInput` reads as a number
export const recipeSourceNumber: RecipeCreate['sourceId'] = 42;
// ...while the record and the Provider's data keep the schema's number or slug.
export const recipeSource: Exactly<RecordOf<typeof recipes>['sourceId'], string | number> = true;
export const recipeSourceData: Exactly<EditData<typeof recipes>['sourceId'], string | number> =
	true;
// A Field may only name a Kind someone declared.
// @ts-expect-error no one declared the Kind "stras"
export const misspeltKind = field(z.number(), { kind: 'stras' });
// The Theme declares its own Kinds, so the app names them without registering anything...
export const themeTextarea = field(z.string(), { kind: 'textarea' });
export const themeBadges = field(z.array(z.string()), { kind: 'badges' });
export const themeImage = field(z.string(), { kind: 'image' }).optional();
// @ts-expect-error the Theme's Kind is `image`, not `img`
export const themeImageTypo = field(z.string(), { kind: 'img' });
// ...and their inputs send what the Field's built-in input would: text for the textarea and the
// image's URL, and the lines of a list in lines.
export const recipeInstructionsInput: Exactly<RecipeCreate['instructions'], string> = true;
export const recipeImageInput: Exactly<RecipeCreate['imageUrl'], string | undefined> = true;
export const recipeTagsInput: Exactly<RecipeCreate['tags'], string> = true;

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

// The sort names one of each Resource's sortable Fields, whether `field()` sits inside a wrapper
// (recipes' calories) or not.
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const recipeSortKeys: Exactly<
	SortableKey<typeof recipes>,
	'name' | 'prepTimeMinutes' | 'caloriesPerServing' | 'publishedAt' | 'rating'
> = true;
export const userSortKeys: Exactly<SortableKey<typeof users>, 'name' | 'joinedAt'> = true;
export const postSortKeys: Exactly<SortableKey<typeof posts>, 'id' | 'title' | 'viewCount'> = true;
export const recipeSort: ListParams<typeof recipes>['sort'] = {
	field: 'caloriesPerServing',
	order: 'desc'
};
export const recipeCuisineSort: ListParams<typeof recipes>['sort'] = {
	// @ts-expect-error recipes can't be sorted by cuisine
	field: 'cuisine',
	order: 'asc'
};
// @ts-expect-error a sort is ascending or descending
export const postSortOrder: ListParams<typeof posts>['sort'] = { field: 'id', order: 'down' };

// Filters name one of each Resource's filterable Fields, with the operators of its Kind and values
// typed by the Field.
export const recipeFilterKeys: Exactly<
	FilterableKey<typeof recipes>,
	'name' | 'cuisine' | 'difficulty' | 'prepTimeMinutes' | 'vegetarian' | 'publishedAt'
> = true;
export const userFilterKeys: Exactly<
	FilterableKey<typeof users>,
	'role' | 'active' | 'joinedAt'
> = true;
export const postFilterKeys: Exactly<FilterableKey<typeof posts>, 'userId' | 'status'> = true;
export const recipeFilters: Exactly<
	ListFilter<typeof recipes>,
	| { field: 'name'; operator: 'in'; value: string[] }
	| { field: 'name'; operator: 'eq' | 'contains'; value: string }
	// Narrowed: no `contains`.
	| { field: 'cuisine'; operator: 'in'; value: string[] }
	| { field: 'cuisine'; operator: 'eq'; value: string }
	| { field: 'difficulty'; operator: 'in'; value: ('Easy' | 'Medium' | 'Hard')[] }
	| { field: 'difficulty'; operator: 'eq'; value: 'Easy' | 'Medium' | 'Hard' }
	| { field: 'prepTimeMinutes'; operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; value: number }
	| { field: 'vegetarian'; operator: 'eq'; value: boolean }
	// A date keeps the Field's own type: an ISO datetime string.
	| { field: 'publishedAt'; operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; value: string }
> = true;
export const userRoles: ListParams<typeof users>['filters'] = [
	{ field: 'role', operator: 'in', value: ['admin', 'editor'] },
	{ field: 'active', operator: 'eq', value: false },
	{ field: 'joinedAt', operator: 'gte', value: '2023-06-01T00:00:00.000Z' }
];
export const postStatus: ListParams<typeof posts>['filters'] = [
	{ field: 'status', operator: 'eq', value: 'draft' },
	{ field: 'userId', operator: 'eq', value: 3 }
];
export const recipeCuisineFilter: ListParams<typeof recipes>['filters'] = [
	// @ts-expect-error cuisine is narrowed to exact matches
	{ field: 'cuisine', operator: 'contains', value: 'Thai' }
];
export const postUserRange: ListParams<typeof posts>['filters'] = [
	// @ts-expect-error a post's author is a Reference, filtered by equality only
	{ field: 'userId', operator: 'gte', value: 3 }
];
// A post's author is a Reference to users: its filter value is a user's id, a number...
export const postAuthorFilter: Exactly<
	Extract<ListFilter<typeof posts>, { field: 'userId' }>,
	{ field: 'userId'; operator: 'eq'; value: IdOf<typeof users> }
> = true;
export const postAuthorText: ListParams<typeof posts>['filters'] = [
	// @ts-expect-error users have number ids
	{ field: 'userId', operator: 'eq', value: '3' }
];
// ...it isn't sortable...
// @ts-expect-error a Reference can't be sortable
export const postSortByAuthor: ListParams<typeof posts>['sort'] = { field: 'userId', order: 'asc' };
// ...and on the forms, its picker's input is typed by the target's id type, a user's id, on create
// and on edit.
export const postAuthorInput: Exactly<
	FormInput<typeof posts, 'create'>['userId'],
	IdOf<typeof users>
> = true;
export const postAuthorEditInput: Exactly<
	FormInput<typeof posts, 'edit'>['userId'],
	IdOf<typeof users>
> = true;
// @ts-expect-error users have number ids
export const postAuthorTextInput: FormInput<typeof posts, 'create'>['userId'] = '3';
// A post may reply to another: an optional self-Reference, typed by a post's id, or left out.
export const postReplyInput: Exactly<
	FormInput<typeof posts, 'edit'>['replyToId'],
	IdOf<typeof posts> | undefined
> = true;
export const postNoReplyInput: FormInput<typeof posts, 'create'>['replyToId'] = undefined;
// @ts-expect-error a post's id is a number
export const postReplyTextInput: FormInput<typeof posts, 'create'>['replyToId'] = '1';
// A Reference whose type isn't its target's id type is rejected.
// @ts-expect-error users have number ids
export const textAuthor = field(z.string(), { ref: () => users });
// @ts-expect-error a Reference can't be sortable
export const sortableAuthor = field(z.number(), { ref: () => users, sortable: true });
// `lookup` gives a user, or `null` when there is none.
export const userLookup: Exactly<
	Awaited<ReturnType<ReturnType<typeof serveResource<typeof users>>['lookup']>>,
	RecordOf<typeof users> | null
> = true;
// The users remote module's `lookup` takes a user's id.
export const userLookupId: Exactly<
	Parameters<ResourceRemote<RecordOf<typeof users>, IdOf<typeof users>>['lookup']>,
	[id: number]
> = true;
export const joinedAtDate: ListParams<typeof users>['filters'] = [
	// @ts-expect-error joinedAt is an ISO string, not a Date
	{ field: 'joinedAt', operator: 'gte', value: new Date() }
];
export const vegetarianIn: ListParams<typeof recipes>['filters'] = [
	// @ts-expect-error a boolean has no `in`
	{ field: 'vegetarian', operator: 'in', value: [true, false] }
];
export const postStatusTypo: ListParams<typeof posts>['filters'] = [
	// @ts-expect-error `archived` isn't a post status
	{ field: 'status', operator: 'eq', value: 'archived' }
];
// A Provider whose `getList` reads a filter on a Field the Resource doesn't declare filterable is
// rejected.
export const postsTitleFilterProvider: Served<typeof posts> = {
	...({} as Omit<ResourceProvider<typeof posts>, 'getList'>),
	// @ts-expect-error posts are only filtered by author and status
	getList: async (
		_ctx: unknown,
		params: {
			page: number;
			perPage: number;
			filters?: { field: 'title'; operator: 'eq'; value: string }[];
		}
	) => ({ data: [], hasNextPage: params.filters === undefined })
};

// A Provider whose `getList` takes the loose `ListParams` and reads a search, as every Provider
// did before list params were typed from the Resource, still fits `serveResource` for every demo
// Resource.
const looseGetList = async (_ctx: unknown, { page, perPage, search }: ListParams) => ({
	data: [],
	total: page + perPage + (search?.length ?? 0)
});
// The rest of each Provider, which this check doesn't look at.
declare const writes: {
	recipes: Omit<ResourceProvider<typeof recipes>, 'getList'>;
	users: Omit<ResourceProvider<typeof users>, 'getList'>;
	posts: Omit<ResourceProvider<typeof posts>, 'getList'>;
};
type Served<R extends Resource> = Parameters<typeof serveResource<R>>[1];
export const recipesProvider: Served<typeof recipes> = { ...writes.recipes, getList: looseGetList };
export const usersProvider: Served<typeof users> = { ...writes.users, getList: looseGetList };
export const postsProvider: Served<typeof posts> = { ...writes.posts, getList: looseGetList };
