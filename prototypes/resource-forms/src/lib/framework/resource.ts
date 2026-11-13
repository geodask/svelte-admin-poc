// PROTOTYPE (PER-17): a cut-down shared Resource module. Client-safe: no Provider, no $app/server.
import { z } from 'zod';

/** How a Field is presented. Only what the forms question needs. */
export type FieldMeta = {
	label?: string;
	description?: string;
	placeholder?: string;
	/** Never shown in any View (e.g. `id`). */
	hidden?: boolean;
	/** Shown on detail and edit, never submitted by a form. The Provider owns the value. */
	readOnly?: boolean;
	/**
	 * Override the input the type would pick.
	 * - `textarea` for long text
	 * - `rows` / `lines` for arrays of text (one input per item vs one textarea, one item per line)
	 */
	input?: 'textarea' | 'rows' | 'lines';
};

export const fieldRegistry = z.registry<FieldMeta>();

/** Attach Field metadata to a schema node (same idea as the PoC's `defineField`). */
export function field<T extends z.ZodType>(schema: T, meta: FieldMeta): T {
	(schema as z.ZodType).register(fieldRegistry, meta);
	return schema;
}

export type Resource<S extends z.ZodObject = z.ZodObject> = {
	name: string;
	label: string;
	schema: S;
	/** The key that identifies a record. Not part of the create form; a hidden input on edit. */
	idKey: keyof z.infer<S> & string;
};

export function defineResource<S extends z.ZodObject>(r: {
	name: string;
	label: string;
	schema: S;
	idKey?: keyof z.infer<S> & string;
}): Resource<S> {
	return { ...r, idKey: r.idKey ?? ('id' as keyof z.infer<S> & string) };
}

export type RecordOf<R extends Resource> = z.infer<R['schema']>;
