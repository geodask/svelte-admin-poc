import type { z } from 'zod';
import { describeFields, type Field } from './fields.ts';

/** Any Zod object schema. `defineResource` checks that it has a usable `id` Field. */
export type ResourceSchema = z.ZodObject;

/**
 * A Resource: a named kind of record the admin manages. It holds metadata only, so the
 * module that defines it is safe to import in the browser. Its data operations are wired on
 * the server with `serveResource` from `@svelte-admin/core/server`.
 */
export type Resource<N extends string = string, S extends ResourceSchema = ResourceSchema> = {
	readonly name: N;
	readonly label: string;
	readonly schema: S;
	/** Its Fields in schema key order, with labels, Kinds and where each one shows. */
	readonly fields: readonly Field[];
};

/** The type of one record of a Resource. */
export type RecordOf<R extends Resource> = z.output<R['schema']>;

// The id schema must give a string or a number, and must take that same type as input, so a
// route param or a query argument can never be coerced into an id ('1' and 1 are not the same).
type IdField = z.ZodType<string, string> | z.ZodType<number, number>;

type HasValidId<S extends ResourceSchema> = 'id' extends keyof S['shape']
	? S['shape']['id'] extends IdField
		? true
		: false
	: false;

type IdRequired = {
	'A Resource schema needs an `id` Field of string or number type, with no coercion': true;
};

export function defineResource<const N extends string, S extends ResourceSchema>(definition: {
	/** The Resource's name, also its URL segment and its key in `admin.ts`. */
	name: N;
	/** The plural label shown in headings and the sidebar, e.g. "Recipes". */
	label: string;
	/** One Zod object schema, the single source of truth for the Resource's Fields. */
	schema: S & (HasValidId<S> extends true ? unknown : IdRequired);
}): Resource<N, S> {
	const { name, label, schema } = definition;
	return { name, label, schema, fields: describeFields(schema) };
}
