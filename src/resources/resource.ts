import { getRequestEvent, query, command } from '$app/server';
import { z } from 'zod';

export type Provider = {
	getMany: () => Promise<unknown[]>;
	getOne: (id: string) => Promise<unknown>;
	create: (data: unknown) => Promise<unknown>;
	update: (id: string, data: unknown) => Promise<unknown>;
	delete: (id: string) => Promise<void>;
};

export function simpleRestProvider(url: string): Provider {
	return {
		getMany: async () => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url);
			const data = await response.json();
			return data.results ?? data;
		},
		getOne: async (id: string) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`);
			return response.json();
		},
		create: async (data: unknown) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			return response.json();
		},
		update: async (id: string, data: unknown) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			return response.json();
		},
		delete: async (id: string) => {
			const { fetch } = getRequestEvent();
			await fetch(`${url}/${id}`, { method: 'DELETE' });
		}
	};
}

export function defineResource<T = unknown>(name: string) {
	return (options: { provider?: Provider } ) => {
		const provider = options?.provider;

		if (provider) {
			return {
				getMany: query(async () => provider.getMany() as Promise<T[]>),
				getOne: query(z.string(), async (id) => provider.getOne(id) as Promise<T>),
				create: command(z.any(), async (data) => provider.create(data) as Promise<T>),
				update: command(
					z.object({ id: z.string(), data: z.any() }),
					async ({ id, data }) => provider.update(id, data) as Promise<T>
				),
				delete: command(z.string(), async (id) => provider.delete(id))
			};
		}

		const notConfigured = () => {
			console.error(`No provider defined for resource: ${name}`);
		};

		return {
			getMany: query(async () => {
				notConfigured();
				return [] as T[];
			}),
			getOne: query(z.string(), async () => {
				notConfigured();
				return null as T | null;
			}),
			create: command(z.any(), async () => {
				notConfigured();
				return null as T | null;
			}),
			update: command(z.object({ id: z.string(), data: z.any() }), async () => {
				notConfigured();
				return null as T | null;
			}),
			delete: command(z.string(), async () => {
				notConfigured();
			})
		};
	};
}
