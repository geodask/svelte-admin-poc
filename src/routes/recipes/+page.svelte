<script lang="ts">
	import { ResourceTable } from '$lib/resource';
	import { useResource } from '../../resources';

	const resource = useResource('recipes');
</script>

<ResourceTable {resource} />
