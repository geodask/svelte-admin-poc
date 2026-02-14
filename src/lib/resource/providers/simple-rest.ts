import { getRequestEvent } from '$app/server';
import { z } from 'zod';
import type { Provider } from '../schemas';

export function simpleRestProvider<T extends z.ZodType>(url: string) {
	return (schema: T): Provider<z.infer<T>> => ({
		getMany: async ({ pagination, sorters, filters }) => {
			const { fetch } = getRequestEvent();
			const params = new URLSearchParams();

			if (pagination?.pageIndex != null) params.set('page', String(pagination.pageIndex + 1));
			if (pagination?.pageSize) params.set('limit', String(pagination.pageSize));

			sorters?.forEach((sorter, i) => {
				params.set(`sort[${i}][field]`, sorter.field);
				params.set(`sort[${i}][order]`, sorter.order);
			});

			filters?.forEach((filter, i) => {
				params.set(`filter[${i}][field]`, filter.field);
				params.set(`filter[${i}][operator]`, filter.operator);
				params.set(`filter[${i}][value]`, String(filter.value));
			});

			const queryString = params.toString();
			const response = await fetch(queryString ? `${url}?${queryString}` : url);
			if (!response.ok) {
				throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
			}
			const data = await response.json();
			const results = data.results ?? data;
			return {
				data: z.array(schema).parse(Array.isArray(results) ? results : []),
				total: data.total ?? data.count
			};
		},
		getOne: async (id) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
			}
			const data = await response.json();
			return { data: schema.parse(data) };
		},
		create: async (input) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			if (!response.ok) {
				throw new Error(`Failed to create: ${response.status} ${response.statusText}`);
			}
			const result = await response.json();
			return { data: schema.parse(result) };
		},
		update: async ({ id, payload }) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				throw new Error(`Failed to update: ${response.status} ${response.statusText}`);
			}
			const result = await response.json();
			return { data: schema.parse(result) };
		},
		deleteOne: async (id) => {
			const { fetch } = getRequestEvent();
			const response = await fetch(`${url}/${id}`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error(`Failed to delete: ${response.status} ${response.statusText}`);
			}
			return {};
		}
	});
}
