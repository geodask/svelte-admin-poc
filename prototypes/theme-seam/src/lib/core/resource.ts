// PROTOTYPE (PER-18) — would be @svelte-admin/core. The shared Resource module: client-safe.
import { z } from 'zod';

/** Only the Field metadata the list View needs. */
export type FieldMeta = {
	label?: string;
	/** Never shown in any View (e.g. `id`). */
	hidden?: boolean;
	sortable?: boolean;
	filterable?: boolean;
};

export const fieldRegistry = z.registry<FieldMeta>();

export function field<T extends z.ZodType>(schema: T, meta: FieldMeta): T {
	(schema as z.ZodType).register(fieldRegistry, meta);
	return schema;
}

export type Resource<S extends z.ZodObject = z.ZodObject> = {
	name: string;
	label: string;
	/** Singular, for buttons and dialogs ("Delete 3 recipes"). */
	singular: string;
	schema: S;
	idKey: keyof z.infer<S> & string;
};

export function defineResource<S extends z.ZodObject>(r: {
	name: string;
	label: string;
	singular: string;
	schema: S;
	idKey?: keyof z.infer<S> & string;
}): Resource<S> {
	return { ...r, idKey: r.idKey ?? ('id' as keyof z.infer<S> & string) };
}
