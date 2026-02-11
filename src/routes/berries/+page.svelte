<script lang="ts">
	import { ResourceProvider, ResourceTable } from '$lib/resource';
	import { useResource } from '../../resources';

	const berries = useResource('berries');
</script>

<ResourceProvider resource={berries}>
	<ResourceTable showActions />
</ResourceProvider>
