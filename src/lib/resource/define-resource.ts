import { query, command } from '$app/server';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/table-core';
import {
	GetManyInputSchema,
	GetOneInputSchema,
	DeleteOneInputSchema,
	type Provider,
	type GetManyResponse,
	type GetOneResponse,
	type CreateResponse,
	type UpdateResponse,
	type DeleteOneResponse,
	type GetManyParams
} from './schemas';
import type { Icon } from '@lucide/svelte';

// Helper type to extract keys from a Zod object schema
type SchemaKeys<T extends z.ZodObject> = keyof z.infer<T> & string;

export type Resource<TSchema extends z.ZodObject> = {
	metadata: {
		name: string;
		label: string;
		icon?: typeof Icon;
		columns?: ColumnDef<z.infer<TSchema>>[];
		schema: TSchema;
	};
	getMany: ReturnType<typeof query<typeof GetManyInputSchema, GetManyResponse<z.infer<TSchema>>>>;
	getOne: ReturnType<typeof query<typeof GetOneInputSchema, GetOneResponse<z.infer<TSchema>>>>;
	create: ReturnType<typeof command<z.ZodObject, CreateResponse<z.infer<TSchema>>>>;
	update: ReturnType<typeof command<z.ZodObject, UpdateResponse<z.infer<TSchema>>>>;
	deleteOne: ReturnType<typeof command<typeof DeleteOneInputSchema, DeleteOneResponse>>;
};

export function defineResource(name: string) {
	return <TSchema extends z.ZodObject>(options: {
		schema: TSchema;
		provider?:
			| Provider<z.infer<TSchema>, SchemaKeys<TSchema>>
			| ((schema: TSchema) => Provider<z.infer<TSchema>, SchemaKeys<TSchema>>);
		label: string;
		icon?: typeof Icon;
		columns?: ColumnDef<z.infer<TSchema>>[];
	}) => {
		const { provider: providerOption, label, columns, schema, icon } = options;

		// Support both direct provider object and factory function
		const provider = typeof providerOption === 'function' ? providerOption(schema) : providerOption;

		type TData = z.infer<TSchema>;
		type TFields = SchemaKeys<TSchema>;

		const metadata = {
			name,
			label: label ?? name,
			columns,
			icon,
			schema
		};

		// Create input schemas that include resource name
		const createInputSchema = schema.partial();

		const updateInputSchema = z.object({
			id: z.string(),
			payload: schema.partial()
		});

		if (provider) {
			return {
				metadata,
				getMany: query(GetManyInputSchema, async (input) =>
					provider.getMany(input as GetManyParams<TFields>)
				),
				getOne: query(GetOneInputSchema, async (id) => provider.getOne(id)),
				create: command(createInputSchema, async (input) =>
					provider.create(input as Partial<TData>)
				),
				update: command(updateInputSchema, async (input) =>
					provider.update({
						id: input.id,
						payload: input.payload as Partial<TData>
					})
				),
				deleteOne: command(DeleteOneInputSchema, async (id) => provider.deleteOne(id))
			};
		}

		// Default return logic...
		return {
			metadata,
			getMany: query(GetManyInputSchema, async () => ({ data: [] as TData[], total: 0 })),
			getOne: query(GetOneInputSchema, async () => ({ data: null as TData | null })),
			create: command(createInputSchema, async () => ({ data: null as TData | null })),
			update: command(updateInputSchema, async () => ({ data: null as TData | null })),
			deleteOne: command(DeleteOneInputSchema, async () => ({}))
		};
	};
}
