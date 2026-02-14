<script lang="ts">
	import * as Resource from '$lib/resource';
	import { useResource } from '../../resources.js';

	const { children, params } = $props();

	const resource = $derived(useResource(params.resource));
</script>

<Resource.ResourceProvider {resource}>
	{@render children()}
</Resource.ResourceProvider>
