<script lang="ts">
	import * as Resource from '$lib/resource';
	import { useResource } from '../../resources';

	const resource = useResource('recipes');

	const { children } = $props();
</script>

<Resource.ResourceProvider {resource}>
	{@render children()}
</Resource.ResourceProvider>
