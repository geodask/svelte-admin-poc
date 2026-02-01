<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import DataTable from '$lib/components/data-table.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useResource } from '../../resources';

	const {
		remotes: { getMany: getBerries },
		metadata: { columns }
	} = useResource('berries');
</script>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AppSidebar variant="inset" />
	<Sidebar.Inset>
		<SiteHeader />
		<div class="flex flex-1 flex-col">
			<div class="@container/main flex flex-1 flex-col gap-2">
				<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					{#if columns}
						<DataTable data={(await getBerries()) as Record<string, unknown>[]} {columns} />
					{/if}
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
