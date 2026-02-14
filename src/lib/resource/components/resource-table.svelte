<script lang="ts">
	import ResourceTableMain from './resource-table-main.svelte';
	import ResourceTablePagination from './resource-table-pagination.svelte';
	import ResourceTableProvider from './resource-table-provider.svelte';
	import ResourceTableToolbar from './resource-table-toolbar.svelte';
</script>

<ResourceTableProvider showActions>
	<div class="flex flex-col gap-4">
		<ResourceTableToolbar />
		<ResourceTableMain />
		<ResourceTablePagination />
	</div>
</ResourceTableProvider>
