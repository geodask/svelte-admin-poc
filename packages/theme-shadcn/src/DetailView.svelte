<!--
	The detail View: one record of a Resource, each Field that isn't hidden as a label and a
	value shown by its Kind, in schema order, under a heading that names the record. It takes the
	admin, the Resource, its remote functions and the record's typed id as props, so a route
	passes them from admin.ts. It is built on the core's headless `createDetailView`.

	The record loads inside a boundary with a `failed` snippet but no `pending` one, so the server
	renders the record, or "not found" with a link back to the list for a record that doesn't
	exist.
-->
<script lang="ts">
	import type { Admin, Resource, ResourceRemote } from '@svelte-admin/core';
	import { createDetailView } from '@svelte-admin/core/views';
	import DetailBody from './DetailBody.svelte';
	import LoadError from './LoadError.svelte';

	let {
		admin,
		resource,
		remote,
		id
	}: {
		/** The admin from admin.ts. */
		admin: Admin;
		resource: Resource;
		remote: ResourceRemote;
		id: string | number;
	} = $props();

	// Derived, so the detail View follows the route to another record or Resource.
	const view = $derived(createDetailView(admin, resource, remote, id));
</script>

<!-- The shell's breadcrumb leads back to the list, so the View has no link of its own. -->
<svelte:boundary>
	<DetailBody {view} />

	{#snippet failed(error, reset)}
		<LoadError
			{error}
			{resource}
			retry={() => view.refresh().then(reset, reset)}
			listViewHref={view.listViewHref}
			target="record"
		/>
	{/snippet}
</svelte:boundary>
