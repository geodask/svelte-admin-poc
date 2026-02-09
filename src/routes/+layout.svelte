<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';

	import AdminSidebar from '$lib/admin/admin-sidebar.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useResources } from '../resources';

	const resources = useResources();

	const { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AdminSidebar {resources} variant="inset" />
	<Sidebar.Inset>
		<SiteHeader />
		<div class="flex flex-1 flex-col">
			<div class="@container/main flex flex-1 flex-col gap-2">
				<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					<div class="px-4 lg:px-6">
						{@render children()}
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
