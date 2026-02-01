<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { ResourceTable } from '$lib/resource';
	import { useResource } from '../../resources';

	const berries = useResource('berries');
</script>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AppSidebar variant="inset" />
	<Sidebar.Inset>
		<SiteHeader />
		<div class="flex flex-1 flex-col">
			<div class="@container/main flex flex-1 flex-col gap-2">
				<div class="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6">
					<ResourceTable resource={berries} />
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
