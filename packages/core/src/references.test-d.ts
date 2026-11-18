// Type tests for References: run by `tsc` (the core's `check`), which fails on an unmet
// `expectTypeOf` or an unused `@ts-expect-error`.
import { expectTypeOf } from 'vitest';
import { z } from 'zod';
import {
	defineResource,
	field,
	type FormInput,
	type ListFilter,
	type ListParams,
	type Resource,
	type ResourceRemote
} from '@svelte-admin/core';
import type { serveResource } from '@svelte-admin/core/server';

const users = defineResource({
	name: 'users',
	label: 'Users',
	schema: z.object({ id: z.number(), name: z.string() })
});

const tags = defineResource({
	name: 'tags',
	label: 'Tags',
	schema: z.object({ id: z.string(), name: z.string() })
});

// The Field's type is the target's id type, inside or outside a wrapper, on either side of field().
export const posts = defineResource({
	name: 'posts',
	label: 'Posts',
	schema: z.object({
		id: z.number(),
		userId: field(z.number(), { label: 'Author', ref: () => users, filterable: true }),
		editorId: field(z.number(), { ref: () => users }).optional(),
		reviewerId: field(z.number().nullable(), { ref: () => users }),
		tagId: field(z.string(), { ref: () => tags, filterable: ['eq'] }).default('bread')
	})
});

// A Reference whose type isn't its target's id type is rejected.
// @ts-expect-error users have number ids
field(z.string(), { ref: () => users });
// @ts-expect-error tags have string ids
field(z.number().optional(), { ref: () => tags });
// @ts-expect-error a Reference holds one id, not a list of them
field(z.array(z.number()), { ref: () => users });

// A sortable Reference is rejected.
// @ts-expect-error a Reference can't be sortable
field(z.number(), { ref: () => users, sortable: true });

// A target whose id type TypeScript can't see takes either id type.
declare const anyResource: Resource;
field(z.number(), { ref: () => anyResource });
field(z.string(), { ref: () => anyResource });

// A Reference filter's value is the target's id type, with `eq` only.
type PostFilter = ListFilter<typeof posts>;
expectTypeOf<Extract<PostFilter, { field: 'userId' }>>().toEqualTypeOf<{
	field: 'userId';
	operator: 'eq';
	value: number;
}>();
expectTypeOf<Extract<PostFilter, { field: 'tagId' }>>().toEqualTypeOf<{
	field: 'tagId';
	operator: 'eq';
	value: string;
}>();
export const authorFilter: ListParams<typeof posts>['filters'] = [
	{ field: 'userId', operator: 'eq', value: 3 }
];
export const authorRange: ListParams<typeof posts>['filters'] = [
	// @ts-expect-error a Reference is filtered by equality only
	{ field: 'userId', operator: 'gte', value: 3 }
];
export const authorText: ListParams<typeof posts>['filters'] = [
	// @ts-expect-error users have number ids
	{ field: 'userId', operator: 'eq', value: '3' }
];

// A Reference isn't sortable, so posts have no sort at all.
expectTypeOf<keyof ListParams<typeof posts>>().toEqualTypeOf<'page' | 'perPage' | 'filters'>();

// Until the Reference picker, the forms send the id itself.
expectTypeOf<FormInput<typeof posts, 'create'>>().toEqualTypeOf<{
	userId: number;
	editorId?: number;
	reviewerId?: number;
	tagId?: string;
}>();

// `lookup` takes one typed id and gives the record, or `null` when it doesn't exist.
type Served = ReturnType<typeof serveResource<typeof users>>;
expectTypeOf<Parameters<Served['lookup']>>().toEqualTypeOf<[id: number]>();
expectTypeOf<Awaited<ReturnType<Served['lookup']>>>().toEqualTypeOf<{
	id: number;
	name: string;
} | null>();
expectTypeOf<ResourceRemote<{ id: number }, number>['lookup']>().parameters.toEqualTypeOf<
	[id: number]
>();
expectTypeOf<
	Awaited<ReturnType<ResourceRemote<{ id: number }, number>['lookup']>>
>().toEqualTypeOf<{
	id: number;
} | null>();
// What serveResource returns stands in for the Resource's remote module.
expectTypeOf<Served>().toExtend<ResourceRemote<{ id: number; name: string }, number>>();

// A Resource that references itself names the arrow's return type, so TypeScript needn't infer
// the Resource from its own initializer. The Field keeps its own type, so its filter value is a number.
export const comments = defineResource({
	name: 'comments',
	label: 'Comments',
	schema: z.object({
		id: z.number(),
		replyToId: field(z.number(), { ref: (): Resource => comments, filterable: true }).optional()
	})
});
export const replyFilter: ListParams<typeof comments>['filters'] = [
	{ field: 'replyToId', operator: 'eq', value: 2 }
];
