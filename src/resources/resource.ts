import { getRequestEvent, query } from '$app/server';

export function simpleRestProvider(url: string) {
	return {
		getList: async () => {
			const { fetch } = getRequestEvent();
			const response = await fetch(url);
			const data = await response.json();
			return data.results;
		}
	};
}

export function defineResource(name: string) {
	return (options: { provider?: ReturnType<typeof simpleRestProvider> }) => {
		const provider = options?.provider;
		if (provider) {
			return {
				getList: query(async () => provider.getList())
			};
		}

		return {
			getList: query(async () => {
				console.error(`No provider defined for resource: ${name}`);
				return [];
			})
		};
	};
}
