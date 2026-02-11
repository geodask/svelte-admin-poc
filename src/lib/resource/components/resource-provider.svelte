<script lang="ts" module>
	import { createContext } from 'svelte';
	import type { ResourceLike } from './types';
	import type { RemoteQuery } from '@sveltejs/kit';

	export type ResourceContextValue<TData = any> = {
		resource: ResourceLike<TData>;
		queries: {
			getMany: RemoteQuery<any> | null;
			getOne: RemoteQuery<any> | null;
		};
	};

	export const [getResourceContext, setResourceContext] = createContext<ResourceContextValue>();
</script>

<script lang="ts">
	interface Props {
		resource: ResourceLike;
		children: import('svelte').Snippet;
	}

	let { resource, children }: Props = $props();

	const ctx: ResourceContextValue = $state({
		get resource() {
			return resource;
		},
		queries: {
			getMany: null,
			getOne: null
		}
	});

	setResourceContext(ctx);
</script>

{@render children()}
