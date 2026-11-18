<!--
	The list View: one page of a Resource's records in a table, with a pager. It takes the admin,
	the Resource and its remote functions as props, so a route passes them from admin.ts. It shows
	each Field the Resource puts on the list, in schema order, by its Kind, and each row links to
	its record's detail View. The page, page size, sort, search and filters live in the URL,
	through the core's headless `createListView`.

	The records load inside a boundary with a `failed` snippet but no `pending` one, so the server
	renders the records (or the failure) and a refresh keeps the old rows until the new ones come.
-->
<script lang="ts">
	import type { Admin, Resource, ResourceRemote } from '@svelte-admin/core';
	import { createListView } from '@svelte-admin/core/views';
	import ListBody from './ListBody.svelte';
	import LoadError from './LoadError.svelte';
	import Toolbar from './Toolbar.svelte';

	let {
		admin,
		resource,
		remote
	}: {
		/** The admin from admin.ts. */
		admin: Admin;
		resource: Resource;
		remote: ResourceRemote;
	} = $props();

	// Derived, so the list View follows the Resource when the route switches to another one.
	const view = $derived(createListView(admin, resource, remote));
</script>

<svelte:head>
	<title>{resource.label}</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{resource.label}</h1>

	<!-- Outside the boundary, so the search can still be changed when a page fails to load. -->
	<Toolbar {view} />

	<svelte:boundary>
		<ListBody {view} />

		{#snippet failed(error, reset)}
			<LoadError
				{error}
				{resource}
				retry={() => view.refresh().then(reset, reset)}
				listViewHref={view.pageHref(1)}
				target="list"
			/>
		{/snippet}
	</svelte:boundary>
</div>
