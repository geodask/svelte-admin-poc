import { getRequestEvent, query, command } from '$app/server';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/table-core';

export type Provider<T> = {
	getMany: () => Promise<T[]>;
	getOne: (id: string) => Promise<T>;
	create: (data: Partial<T>) => Promise<T>;
	update: (id: string, data: Partial<T>) => Promise<T>;
	delete: (id: string) => Promise<void>;
};

// We define a helper type to represent the Resource structure
export type Resource<TSchema extends z.ZodObject> = {
	metadata: {
		name: string;
		label: string;
		columns?: ColumnDef<z.infer<TSchema>>[];
		schema: TSchema;
	};
	getMany: ReturnType<typeof query<z.ZodVoid, z.infer<TSchema>[]>>;
	getOne: ReturnType<typeof query<z.ZodString, z.infer<TSchema>>>;
	create: ReturnType<typeof command<z.ZodObject, z.infer<TSchema>>>;
	update: ReturnType<typeof command<z.ZodObject, z.infer<TSchema>>>;
	delete: ReturnType<typeof command<z.ZodString, void>>;
};

export function simpleRestProvider<T extends z.ZodType>(url: string) {
	return (schema: T): Provider<z.infer<T>> => ({
		getMany: async () => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url);
			const data = await response.json();
			const results = data.results ?? data;
			return z.array(schema).parse(results);
		},
		getOne: async (id: string) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`);
			const data = await response.json();
			return schema.parse(data);
		},
		create: async (data: Partial<z.infer<T>>) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const result = await response.json();
			return schema.parse(result);
		},
		update: async (id: string, data: Partial<z.infer<T>>) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const result = await response.json();
			return schema.parse(result);
		},
		delete: async (id: string) => {
			const { fetch } = getRequestEvent();
			await fetch(`${url}/${id}`, { method: 'DELETE' });
		}
	});
}

export function defineResource(name: string) {
	return <TSchema extends z.ZodObject>(options: {
		schema: TSchema;
		provider?: (schema: TSchema) => Provider<z.infer<TSchema>>;
		label?: string;
		columns?: ColumnDef<z.infer<TSchema>>[];
	}) => {
		const { provider: providerFactory, label, columns, schema } = options;
		const provider = providerFactory?.(schema);

		// This local type alias helps TS flow the inference
		type TData = z.infer<TSchema>;

		const metadata = {
			name,
			label: label ?? name,
			columns,
			schema
		};

		if (provider) {
			return {
				metadata,
				getMany: query(z.void(), async () => provider.getMany()),
				getOne: query(z.string(), async (id) => provider.getOne(id)),
				create: command(schema.partial(), async (data) => provider.create(data as Partial<TData>)),
				update: command(
					z.object({ id: z.string(), data: schema.partial() }),
					async ({ id, data }) => provider.update(id, data as Partial<TData>)
				),
				delete: command(z.string(), async (id) => provider.delete(id))
			};
		}

		// Default return logic...
		return {
			metadata,
			getMany: query(z.void(), async () => [] as TData[]),
			getOne: query(z.string(), async () => null as TData | null),
			create: command(schema.partial(), async () => null as TData | null),
			update: command(
				z.object({ id: z.string(), data: schema.partial() }),
				async () => null as TData | null
			),
			delete: command(z.string(), async () => {})
		};
	};
}
